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
import { getProjectRoot } from '../utils/paths.js';

const projectRoot = getProjectRoot(__dirname);

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

async function initDatabase(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'roadguard';
  const ssl = getSslConfig();

  console.log(`[RoadGuard DB Init] Connecting to MySQL at ${host}:${port} as '${user}' (SSL: ${ssl ? 'enabled' : 'disabled'})...`);

  let connection: mysql.Connection | null = null;

  try {
    if (process.env.DATABASE_URL) {
      connection = await mysql.createConnection({
        uri: process.env.DATABASE_URL,
        ssl,
        multipleStatements: true,
      });
      console.log('[RoadGuard DB Init] Connected using DATABASE_URL.');
    } else {
      // First attempt connecting with database specified
      try {
        connection = await mysql.createConnection({
          host,
          port,
          user,
          password,
          database,
          ssl,
          multipleStatements: true,
        });
        console.log(`[RoadGuard DB Init] Connected directly to database '${database}'.`);
      } catch (directErr: any) {
        // If database doesn't exist, connect to MySQL server root to create it
        console.log(`[RoadGuard DB Init] Could not connect directly to '${database}' (${directErr.message}). Attempting root connection to create database...`);
        connection = await mysql.createConnection({
          host,
          port,
          user,
          password,
          ssl,
          multipleStatements: true,
        });
        console.log('[RoadGuard DB Init] Connected to MySQL server root.');
      }
    }

    // Locate the schema SQL file
    const schemaCandidates = [
      join(projectRoot, 'server/db/schema.sql'),
      join(__dirname, 'schema.sql'),
    ];
    const schemaPath = schemaCandidates.find(p => fs.existsSync(p));
    if (!schemaPath) {
      throw new Error(`Schema file not found in candidates: ${schemaCandidates.join(', ')}`);
    }

    let schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    // Adapt database name if custom DB_NAME is specified (e.g. cloud provider defaultdb)
    if (database && database !== 'roadguard') {
      schemaSql = schemaSql.replace(/CREATE DATABASE IF NOT EXISTS roadguard/g, `CREATE DATABASE IF NOT EXISTS \`${database}\``);
      schemaSql = schemaSql.replace(/USE roadguard;/g, `USE \`${database}\`;`);
    }

    console.log('[RoadGuard DB Init] Executing database schema...');
    await connection.query(schemaSql);

    console.log(`[RoadGuard DB Init] ✓ Database '${database}' initialized successfully.`);
    console.log('[RoadGuard DB Init] ✓ Tables ready: inspections, detections, road_issues');

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
