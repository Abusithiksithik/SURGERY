'use strict';

const { Pool } = require('pg');
const { env } = require('./env');
const logger = require('./logger');

/**
 * Single shared pg Pool instance for the whole process.
 * All services import { pool } from this module.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('[pg pool] Unexpected error on idle client:', err.message);
});

/** Helper: run a parameterized query and return the full result object. */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (env.NODE_ENV === 'development') {
    logger.debug(`[pg] ${text.slice(0, 80)}... (${Date.now() - start}ms, ${res.rowCount} rows)`);
  }
  return res;
}

/** Helper: run a query and return just the rows array. */
async function queryRows(text, params) {
  const res = await query(text, params);
  return res.rows;
}

/** Helper: run a query and return the first row or null. */
async function queryOne(text, params) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

/**
 * Run multiple statements in a transaction.
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function disconnectPool() {
  await pool.end();
}

module.exports = { pool, query, queryRows, queryOne, withTransaction, disconnectPool };
