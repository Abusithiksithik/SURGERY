'use strict';

/**
 * initializeDatabase.js
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Automatic bootstrap on every `npm start / npm run dev`.
 *
 * Steps:
 *   1. Ensure the hospital database exists.
 *   2. Apply schema (01â€“05) â€” fully idempotent, safe every boot.
 *   3. Seed master data only when the surgeons table is empty.
 *   4. ALWAYS refresh materialized views â€” even when seed was skipped.
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
  path.join(DB_DIR, 'split', '17_missing_modules.sql'),
  path.join(DB_DIR, 'split', '18_roles_permissions.sql'),
  path.join(DB_DIR, 'split', '19_professional_master.sql'),
  path.join(DB_DIR, 'split', '20_ot_rooms.sql'),
  path.join(DB_DIR, 'split', '21_vendors.sql'),
  path.join(DB_DIR, 'split', '22_item_master.sql'),
  path.join(DB_DIR, 'split', '23_instruments_assets.sql'),
  path.join(DB_DIR, 'split', '24_procedure_card.sql'),
  path.join(DB_DIR, 'split', '25_case_condition_payer.sql'),
  path.join(DB_DIR, 'split', '26_surgery_number.sql'),
  // Tracked migrations 27-39 are discovered by sequence number. Existing
  // 01-26 bootstrap behavior is intentionally preserved.
  ...fs.readdirSync(path.join(DB_DIR, 'split'))
    .filter((name) => /^(2[7-9]|3[0-9]|[1-9][0-9]{2,})_.+\.sql$/.test(name))
    .sort()
    .map((name) => path.join(DB_DIR, 'split', name)),
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
 *   42P01 â€” view doesn't exist yet (schema not applied yet, or view was dropped)
 *   55000 â€” view exists but was created WITH NO DATA and never refreshed
 * Any other error is rethrown (real SQL problem we want to know about).
 */
async function refreshMatview(client, viewName) {
  try {
    await client.query(`REFRESH MATERIALIZED VIEW ${viewName}`);
    logger.info(`  âœ“ refreshed ${viewName}`);
  } catch (err) {
    if (err.code === '42P01') {
      logger.warn(`  âš  ${viewName} does not exist yet â€” skipping refresh`);
    } else if (err.code === '55000') {
      // This should not happen if we REFRESH (non-concurrent), but guard anyway
      logger.warn(`  âš  ${viewName} not in prerequisite state â€” skipping`);
    } else {
      throw err;   // unexpected â€” propagate
    }
  }
}

/**
 * Refresh all materialized views using the current pg Client.
 * Safe to call on every startup â€” 0-row views are valid when no data exists yet.
 */
async function refreshAllMatviews(client) {
  logger.info('  Refreshing materialized viewsâ€¦');
  for (const v of MATVIEWS) {
    await refreshMatview(client, v);
  }
  logger.info('âœ“ Materialized views refreshed');
}

async function initializeDatabase() {
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Add it to backend/.env:\n' +
      '  DATABASE_URL=postgresql://postgres:12345@localhost:5432/hospital'
    );
  }

  // â”€â”€ Step 1: Ensure the target database exists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const connInfo = await ensureDatabaseExists(env.DATABASE_URL);
  logger.info('âœ“ PostgreSQL connected');

  // â”€â”€ Step 2: Apply schema (idempotent on every startup) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const client = makeClient(connInfo);
  await client.connect();

  try {
    for (const filePath of SCHEMA_FILES) {
      const label = path.basename(filePath);
      const migrationMatch = label.match(/^(2[7-9]|3[0-9])_(.+)\.sql$/);
      try {
        // Keep legacy migrations 01-26 unchanged. Migrations 27-39 are tracked,
        // transactional, and skipped after successful application.
        if (migrationMatch) {
          await client.query(`
            CREATE TABLE IF NOT EXISTS app_migration_markers (
              marker_key VARCHAR(120) PRIMARY KEY,
              applied_at TIMESTAMP(3) NOT NULL DEFAULT now()
            )
          `);
          const markerKey = label.replace(/\.sql$/, '');
          const { rows } = await client.query(
            'SELECT 1 FROM app_migration_markers WHERE marker_key = $1 LIMIT 1',
            [markerKey]
          );

          // Migration 27 may have been applied before marker tracking was added.
          // Always verify the live schema before trusting or creating its marker.
          if (markerKey === '27_stock_ledger') {
            const verification = await client.query(`
              SELECT
                to_regclass('public.stock_locations') IS NOT NULL AS locations,
                to_regclass('public.stock_receipts') IS NOT NULL AS receipts,
                to_regclass('public.stock_ledger') IS NOT NULL AS ledger,
                to_regclass('public.v_stock_balance') IS NOT NULL AS balance_view,
                EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_stock_ledger_append_only' AND NOT tgisinternal) AS ledger_append_only,
                EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_stock_receipts_append_only' AND NOT tgisinternal) AS receipts_append_only,
                EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_validate_stock_reversal' AND NOT tgisinternal) AS reversal_validation,
                EXISTS (SELECT 1 FROM system_permissions WHERE permission_key='RECEIVE_STOCK') AS receive_permission,
                EXISTS (SELECT 1 FROM system_permissions WHERE permission_key='ENTER_CASE_USAGE') AS usage_permission,
                EXISTS (SELECT 1 FROM system_permissions WHERE permission_key='RECORD_GAS') AS gas_permission,
                EXISTS (SELECT 1 FROM system_permissions WHERE permission_key='RECORD_PHARMACY_BILL') AS pharmacy_permission
            `);
            const state = verification.rows[0];
            const schemaComplete = Object.values(state).every(Boolean);
            if (rows.length > 0) {
              if (!schemaComplete) {
                throw new Error('Migration marker exists, but required Stock Ledger objects are missing. Restore the database or repair migration 27 before startup.');
              }
              logger.info(`  ↷ ${label} (marker and schema verified — skipped)`);
              continue;
            }
            if (schemaComplete) {
              await client.query(
                'INSERT INTO app_migration_markers (marker_key) VALUES ($1) ON CONFLICT (marker_key) DO NOTHING',
                [markerKey]
              );
              logger.info(`  ↷ ${label} (existing schema verified — marker recorded, skipped)`);
              continue;
            }
          } else if (rows.length > 0) {
            logger.info(`  ↷ ${label} (already applied — skipped)`);
            continue;
          }

          await client.query('BEGIN');
          try {
            await client.query(readSql(filePath));
            await client.query(
              'INSERT INTO app_migration_markers (marker_key) VALUES ($1) ON CONFLICT (marker_key) DO NOTHING',
              [markerKey]
            );
            await client.query('COMMIT');
            logger.info(`  ✓ ${label} (applied and recorded)`);
          } catch (migrationError) {
            await client.query('ROLLBACK');
            throw migrationError;
          }
        } else {
          await client.query(readSql(filePath));
          logger.info(`  ✓ ${label}`);
        }
      } catch (err) {
        throw new Error(`Failed applying ${label}: ${err.message}`);
      }
    }
    logger.info('âœ“ Schema applied');

    // â”€â”€ Step 3: Seed master + surgery data when surgeons table is empty â”€â”€
    const { rows: surgeonCheck } = await client.query('SELECT 1 FROM surgeons LIMIT 1');
    if (surgeonCheck.length === 0) {
      logger.info('  No master data found â€” running seed â€¦');
      try {
        await client.query(readSql(SEED_FILE));
        logger.info('âœ“ SQL seed complete');
      } catch (seedErr) {
        logger.warn(`  SQL seed failed (${seedErr.message}) â€” using Node.js fallback for base records`);
      }
      // Initialize admin credentials from environment; never seed a hardcoded default password.
      await nodejsSeed(client);
      logger.info('âœ“ Seed complete â€” admin account initialized');
    } else {
      logger.info('âœ“ Seed skipped (master data already present)');
    }

    // â”€â”€ Step 4: ALWAYS refresh materialized views â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // This runs whether or not seed was skipped.  It guarantees that
    // no query hits a "materialized view has not been populated" error
    // (PostgreSQL error 55000) during normal API operation.
    // Mobile OT PWA access is a permission seed, not a schema migration.
    // Idempotent: creates no tables and never overwrites existing grants.
    await client.query(`INSERT INTO system_permissions(permission_key, description)
      VALUES ('MOBILE_OT_ACCESS', 'Access the dedicated mobile OT Store PWA (maximum three assigned users)')
      ON CONFLICT (permission_key) DO NOTHING`);
    await client.query(`INSERT INTO system_role_permissions(role_name, permission_id, is_granted)
      SELECT roles.role_name, p.permission_id, FALSE
      FROM (VALUES ('ADMIN'),('MANAGEMENT'),('FINANCE'),('OT_COORDINATOR'),('SURGEON'),('ANAESTHETIST'),('OT_NURSE'),('OT_TECHNICIAN'),('OT_STORE'),('VIEWER')) roles(role_name)
      CROSS JOIN system_permissions p WHERE p.permission_key='MOBILE_OT_ACCESS'
      ON CONFLICT (role_name, permission_id) DO NOTHING`);

    await refreshAllMatviews(client);

  } finally {
    await client.end();
  }

  logger.info('âœ“ Database ready');
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
     SELECT '00000000-0000-0000-0000-000000000003'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            $1::text, $2::text, $3::text, $4::text, 'ADMIN'
     WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = $1::text)`,
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

  logger.info('âœ“ Node.js seed complete â€” admin account initialized');
}

module.exports = { initializeDatabase };
