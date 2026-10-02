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
 * Ensures optional schema columns exist in existing databases without breaking data.
 */
async function ensureSchema(p: mysql.Pool): Promise<void> {
  try {
    const [cols]: any = await p.query("SHOW COLUMNS FROM inspections LIKE 'latitude'");
    if (cols && cols.length === 0) {
      await p.query(
        "ALTER TABLE inspections ADD COLUMN latitude DECIMAL(10, 7) DEFAULT NULL, ADD COLUMN longitude DECIMAL(11, 7) DEFAULT NULL, ADD INDEX idx_inspections_location (latitude, longitude)"
      );
      console.log('[RoadGuard DB] Added latitude/longitude columns to inspections table.');
    }
  } catch {
    // Non-critical schema check
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
