'use strict';

/**
 * initializeDatabase.js
 * ─────────────────────
 * Automatic bootstrap on every `npm start / npm run dev`.
 *
 * Steps:
 *   1. Ensure the hospital database exists.
 *   2. Apply schema (01–05) — fully idempotent, safe every boot.
 *   3. Seed master data only when the surgeons table is empty.
 *   4. ALWAYS refresh materialized views — even when seed was skipped.
 *      Matviews are created WITH NO DATA by 05_indexes.sql; querying
 *      them without a prior REFRESH throws PostgreSQL error 55000
 *      ("materialized view has not been populated").  A plain REFRESH
 *      (non-concurrent) is always safe: if there is no completed-surgery
 *      data the views simply contain 0 rows, which is a valid state.
 */

const fs     = require('fs');
const path   = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');
const { ensureDatabaseExists } = require('./ensureDatabaseExists');
const { env } = require('../config/env');

const DB_DIR = path.join(__dirname, '..', '..', 'database');

const SCHEMA_FILES = [
  path.join(DB_DIR, 'split', '01_extensions.sql'),
  path.join(DB_DIR, 'split', '02_enums.sql'),
  path.join(DB_DIR, 'split', '03_tables.sql'),
  path.join(DB_DIR, 'split', '04_constraints.sql'),
  path.join(DB_DIR, 'split', '05_indexes.sql'),
  path.join(DB_DIR, 'split', '07_m1m2_migration.sql'),
  path.join(DB_DIR, 'split', '08_m3_scheduling.sql'),
  path.join(DB_DIR, 'split', '09_status_workflow.sql'),
  path.join(DB_DIR, 'split', '10_v11_requirements.sql'),
  path.join(DB_DIR, 'split', '11_preop_checklist.sql'),
  path.join(DB_DIR, 'split', '12_preop_completion.sql'),
  path.join(DB_DIR, 'split', '13_fix_schedule_status_sync.sql'),
  path.join(DB_DIR, 'split', '14_surgery_checklist_and_docs.sql'),
  path.join(DB_DIR, 'split', '15_fix_mr_number_unique.sql'),
  path.join(DB_DIR, 'split', '16_dedup_active_templates.sql'),
];

const SEED_FILE = path.join(DB_DIR, 'split', '06_seed.sql');

/**
 * Materialized views that must exist and be refreshed on every startup.
 * Order matters: mv_surgeon_stats / mv_surgery_type_stats / etc. all read from
 * v_completed_surgeries, so they can be refreshed in any order.
 * We use plain REFRESH (not CONCURRENTLY) because:
 *   - CONCURRENTLY requires at least one row + a unique index already populated.
 *   - Plain REFRESH always works, even on an empty view.
 *   - The startup cost is negligible for typical datasets.
 */
const MATVIEWS = [
  'mv_surgeon_stats',
  'mv_surgery_type_stats',
  'mv_anaesthetist_stats',
  'mv_ot_stats',
  'mv_monthly_financials',
];

function readSql(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`SQL file not found: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function makeClient(connInfo) {
  return new Client({
    user:     connInfo.user,
    password: connInfo.password,
    host:     connInfo.host,
    port:     connInfo.port,
    database: connInfo.database,
    ssl:      connInfo.ssl,
    connectionTimeoutMillis: 10000,
    statement_timeout:       120000,   // allow up to 2 min for matview refresh
  });
}

/**
 * Refresh a single materialized view, handling the two expected "not ready" errors:
 *   42P01 — view doesn't exist yet (schema not applied yet, or view was dropped)
 *   55000 — view exists but was created WITH NO DATA and never refreshed
 * Any other error is rethrown (real SQL problem we want to know about).
 */
async function refreshMatview(client, viewName) {
  try {
    await client.query(`REFRESH MATERIALIZED VIEW ${viewName}`);
    logger.info(`  ✓ refreshed ${viewName}`);
  } catch (err) {
    if (err.code === '42P01') {
      logger.warn(`  ⚠ ${viewName} does not exist yet — skipping refresh`);
    } else if (err.code === '55000') {
      // This should not happen if we REFRESH (non-concurrent), but guard anyway
      logger.warn(`  ⚠ ${viewName} not in prerequisite state — skipping`);
    } else {
      throw err;   // unexpected — propagate
    }
  }
}

/**
 * Refresh all materialized views using the current pg Client.
 * Safe to call on every startup — 0-row views are valid when no data exists yet.
 */
async function refreshAllMatviews(client) {
  logger.info('  Refreshing materialized views…');
  for (const v of MATVIEWS) {
    await refreshMatview(client, v);
  }
  logger.info('✓ Materialized views refreshed');
}

async function initializeDatabase() {
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Add it to backend/.env:\n' +
      '  DATABASE_URL=postgresql://postgres:12345@localhost:5432/hospital'
    );
  }

  // ── Step 1: Ensure the target database exists ────────────────────────
  const connInfo = await ensureDatabaseExists(env.DATABASE_URL);
  logger.info('✓ PostgreSQL connected');

  // ── Step 2: Apply schema (idempotent on every startup) ───────────────
  const client = makeClient(connInfo);
  await client.connect();

  try {
    for (const filePath of SCHEMA_FILES) {
      const label = path.basename(filePath);
      try {
        await client.query(readSql(filePath));
        logger.info(`  ✓ ${label}`);
      } catch (err) {
        throw new Error(`Failed applying ${label}: ${err.message}`);
      }
    }
    logger.info('✓ Schema applied');

    // ── Step 3: Seed master + surgery data when surgeons table is empty ──
    const { rows: surgeonCheck } = await client.query('SELECT 1 FROM surgeons LIMIT 1');
    if (surgeonCheck.length === 0) {
      logger.info('  No master data found — running seed …');
      try {
        await client.query(readSql(SEED_FILE));
        logger.info(`✓ Seed complete — login: ${env.ADMIN_USERNAME} / ${env.ADMIN_PASSWORD}`);
      } catch (seedErr) {
        logger.warn(`  SQL seed failed (${seedErr.message}) — using Node.js bcrypt fallback`);
        await nodejsSeed(client);
      }
    } else {
      logger.info('✓ Seed skipped (master data already present)');
    }

    // ── Step 4: ALWAYS refresh materialized views ─────────────────────
    // This runs whether or not seed was skipped.  It guarantees that
    // no query hits a "materialized view has not been populated" error
    // (PostgreSQL error 55000) during normal API operation.
    await refreshAllMatviews(client);

  } finally {
    await client.end();
  }

  logger.info('✓ Database ready');
}

async function nodejsSeed(client) {
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, env.BCRYPT_SALT_ROUNDS);

  await client.query(`
    INSERT INTO branches (branch_id, branch_code, branch_name, city)
    VALUES ('00000000-0000-0000-0000-000000000001','MAIN','Main Hospital','Madurai')
    ON CONFLICT (branch_code) DO NOTHING
  `);

  await client.query(`
    INSERT INTO departments (department_id, branch_id, department_code, department_name)
    VALUES (
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000001',
      'GEN', 'General Surgery'
    )
    ON CONFLICT (branch_id, department_code) DO NOTHING
  `);

  await client.query(
    `INSERT INTO users (user_id, branch_id, username, email, password_hash, full_name, role)
     SELECT '00000000-0000-0000-0000-000000000003',
            '00000000-0000-0000-0000-000000000001',
            $1, $2, $3, $4, 'ADMIN'
     WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = $1)`,
    [env.ADMIN_USERNAME, env.ADMIN_EMAIL, passwordHash, env.ADMIN_FULL_NAME]
  );

  const thresholds = [
    ['SURGEON_FEE_HIGH',    10, 25],
    ['ASSISTANT_COST_HIGH', 10, 25],
    ['OT_DURATION_LONG',    15, 30],
    ['OT_COST_HIGH',        10, 25],
    ['CONSUMABLES_HIGH',    10, 25],
    ['MARGIN_BELOW_TARGET', 10, 25],
    ['QUOTE_TOO_LOW',       10, 25],
    ['NEGATIVE_PROFIT',      0,  0],
    ['BUDGET_EXCEEDED',     10, 25],
    ['COLLECTION_PENDING',  10, 25],
  ];
  for (const [alertType, yellow, red] of thresholds) {
    await client.query(
      `INSERT INTO alert_thresholds (branch_id, alert_type, yellow_threshold_pct, red_threshold_pct)
       SELECT NULL, $1, $2, $3
       WHERE NOT EXISTS (
         SELECT 1 FROM alert_thresholds WHERE branch_id IS NULL AND alert_type = $1
       )`,
      [alertType, yellow, red]
    );
  }

  logger.info(`✓ Node.js seed complete — admin: "${env.ADMIN_USERNAME}"`);
}

module.exports = { initializeDatabase };
