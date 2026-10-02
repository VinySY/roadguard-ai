import mysql from 'mysql2/promise';

/**
 * MySQL Connection Pool for RoadGuard AI.
 * 
 * Uses mysql2 connection pooling for efficient, reusable connections.
 * The pool is lazily initialized and the application continues
 * functioning even if MySQL is unavailable.
 */

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: any;
}

function getSslConfig(): any {
  const sslEnabled =
    process.env.DB_SSL === 'true' ||
    process.env.MYSQL_SSL === 'true' ||
    process.env.DB_SSL_MODE === 'REQUIRED';

  if (!sslEnabled) return undefined;

  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

function getDbConfig(): DbConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'roadguard',
    ssl: getSslConfig(),
  };
}

let pool: mysql.Pool | null = null;

/**
 * Returns the MySQL connection pool, creating it on first call.
 * Returns null if the pool cannot be created.
 */
export function getPool(): mysql.Pool | null {
  if (pool) return pool;

  try {
    const ssl = getSslConfig();

    if (process.env.DATABASE_URL) {
      pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        ssl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      });
      console.log('[RoadGuard DB] Pool created from DATABASE_URL');
    } else {
      const config = getDbConfig();
      pool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        // Auto-reconnect on transient failures
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      });
      console.log(
        `[RoadGuard DB] Pool created for ${config.host}:${config.port}/${config.database} (SSL: ${ssl ? 'enabled' : 'disabled'})`
      );
    }
    
    // Automatically ensure optional schema columns exist
    ensureSchema(pool);

    return pool;
  } catch (err) {
    console.error('[RoadGuard DB] Failed to create connection pool:', err);
    return null;
  }
}

/**
 * Ensures required database tables exist without breaking existing data.
 */
async function ensureSchema(p: mysql.Pool): Promise<void> {
  try {
    // 1. inspections table
    await p.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        image_filename VARCHAR(512) NOT NULL,
        image_path VARCHAR(1024) DEFAULT NULL,
        image_width INT UNSIGNED NOT NULL DEFAULT 0,
        image_height INT UNSIGNED NOT NULL DEFAULT 0,
        detection_count INT UNSIGNED NOT NULL DEFAULT 0,
        unique_pothole_count INT UNSIGNED DEFAULT NULL,
        overall_risk ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
        damage_percentage DECIMAL(7, 2) NOT NULL DEFAULT 0.00,
        confidence_threshold INT UNSIGNED NOT NULL DEFAULT 20,
        latitude DECIMAL(10, 7) DEFAULT NULL,
        longitude DECIMAL(11, 7) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_inspections_created (created_at),
        INDEX idx_inspections_risk (overall_risk),
        INDEX idx_inspections_location (latitude, longitude)
      ) ENGINE=InnoDB;
    `);

    // 2. detections table
    await p.query(`
      CREATE TABLE IF NOT EXISTS detections (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        inspection_id INT UNSIGNED NOT NULL,
        class_name VARCHAR(128) NOT NULL DEFAULT 'pothole',
        confidence DECIMAL(5, 4) NOT NULL DEFAULT 0.0000,
        severity ENUM('minor', 'moderate', 'high', 'critical') NOT NULL DEFAULT 'minor',
        x DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        y DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        width DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        height DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        polygon_points JSON DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_detections_inspection (inspection_id),
        CONSTRAINT fk_detections_inspection
          FOREIGN KEY (inspection_id) REFERENCES inspections(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 3. road_issues table
    await p.query(`
      CREATE TABLE IF NOT EXISTS road_issues (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        category VARCHAR(128) NOT NULL,
        description TEXT NOT NULL,
        latitude DECIMAL(10, 7) DEFAULT NULL,
        longitude DECIMAL(11, 7) DEFAULT NULL,
        severity ENUM('minor', 'moderate', 'high', 'critical') NOT NULL DEFAULT 'minor',
        status ENUM('Reported', 'In Inspection', 'Scheduled for Repair', 'Resolved') NOT NULL DEFAULT 'Reported',
        evidence_path VARCHAR(1024) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_issues_status (status),
        INDEX idx_issues_severity (severity),
        INDEX idx_issues_location (latitude, longitude),
        INDEX idx_issues_created (created_at)
      ) ENGINE=InnoDB;
    `);

    // 4. Ensure optional latitude/longitude columns exist on older tables
    const [cols]: any = await p.query("SHOW COLUMNS FROM inspections LIKE 'latitude'");
    if (cols && cols.length === 0) {
      await p.query(
        "ALTER TABLE inspections ADD COLUMN latitude DECIMAL(10, 7) DEFAULT NULL, ADD COLUMN longitude DECIMAL(11, 7) DEFAULT NULL, ADD INDEX idx_inspections_location (latitude, longitude)"
      );
      console.log('[RoadGuard DB] Added latitude/longitude columns to inspections table.');
    }

    console.log('[RoadGuard DB] ✓ Database tables verified and ready (inspections, detections, road_issues)');
  } catch (err: any) {
    console.warn('[RoadGuard DB] Non-fatal error ensuring schema:', err.message);
  }
}

/**
 * Health check: attempts a simple query to verify database reachability.
 * Returns { connected: true } or { connected: false, error: string }.
 */
export async function checkDbHealth(): Promise<{ connected: boolean; error?: string }> {
  const p = getPool();
  if (!p) {
    return { connected: false, error: 'Connection pool not initialized' };
  }

  try {
    await p.query('SELECT 1');
    return { connected: true };
  } catch (err: any) {
    return { connected: false, error: err.message || 'Unknown database error' };
  }
}

/**
 * Gracefully close the pool on shutdown.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[RoadGuard DB] Connection pool closed.');
  }
}
