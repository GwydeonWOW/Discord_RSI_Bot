import pg from 'pg';
import config from '../config.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', err);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Query executed', { text: text.substring(0, 100), duration, rows: res.rowCount });
  return res;
}

export async function getClient() {
  return pool.connect();
}

export async function runMigrations() {
  logger.info('Running database migrations...');
  const migrationFile = join(__dirname, 'migrations', '001_init.sql');
  const sql = readFileSync(migrationFile, 'utf8');
  await pool.query(sql);
  logger.info('Database migrations completed');
}

export async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    logger.info(`Database connected at ${res.rows[0].now}`);
    return true;
  } catch (err) {
    logger.error('Database connection failed', err);
    return false;
  }
}

export default { query, getClient, runMigrations, testConnection };
