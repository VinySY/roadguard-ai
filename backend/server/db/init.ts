import 'dotenv/config';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mysql from 'mysql2/promise';

/**
 * Database initialization script for RoadGuard AI.
 * 
 * Reads schema.sql and executes it against the MySQL server.
 * This creates the `roadguard` database and all required tables.
 * 
 * Usage: npx tsx server/db/init.ts
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initDatabase(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';

  console.log(`[RoadGuard DB Init] Connecting to MySQL at ${host}:${port} as '${user}'...`);

  let connection: mysql.Connection | null = null;

  try {
    // Connect without specifying a database (it may not exist yet)
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
    });

    console.log('[RoadGuard DB Init] Connected to MySQL server.');

    // Read the schema SQL
    const schemaPath = join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    console.log('[RoadGuard DB Init] Executing schema...');

    await connection.query(schemaSql);

    console.log('[RoadGuard DB Init] ✓ Database "roadguard" initialized successfully.');
    console.log('[RoadGuard DB Init] ✓ Tables: inspections, detections, road_issues');

  } catch (err: any) {
    console.error('[RoadGuard DB Init] ✗ Failed to initialize database:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();
