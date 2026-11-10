'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const migrationPath = path.join(root, 'database', 'split', '27_stock_ledger.sql');
const bootstrapPath = path.join(root, 'src', 'db', 'initializeDatabase.js');
const sql = fs.readFileSync(migrationPath, 'utf8');
const bootstrap = fs.readFileSync(bootstrapPath, 'utf8');

test('S3-1 migration is discovered after migration 26', () => {
  assert.match(bootstrap, /26_surgery_number\.sql'/);
  assert.match(bootstrap, /readdirSync/);
  assert.match(bootstrap, /2\[7-9\]\|3\[0-9\]/);
  assert.ok(fs.existsSync(migrationPath));
});

test('S3-1 reuses existing item/vendor/user/surgery masters', () => {
  assert.match(sql, /REFERENCES consumable_items\(item_id\)/);
  assert.match(sql, /REFERENCES vendors\(vendor_id\)/);
  assert.match(sql, /REFERENCES users\(user_id\)/);
  assert.match(sql, /REFERENCES surgeries\(surgery_id\)/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS\s+(items|stock_items)\b/i);
});

test('ledger enforces one positive movement direction and idempotency', () => {
  assert.match(sql, /ck_stock_ledger_one_direction/);
  assert.match(sql, /UNIQUE INDEX IF NOT EXISTS uq_stock_ledger_idempotency/);
  assert.match(sql, /idempotency_key UUID NOT NULL/);
  assert.match(sql, /fn_validate_stock_reversal/);
  assert.match(sql, /Reversal must exactly negate the original stock movement/);
});

test('ledger and receipt records are append-only', () => {
  assert.match(sql, /BEFORE UPDATE OR DELETE ON stock_ledger/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON stock_receipts/);
  assert.match(sql, /append-only; record a reversal\/correction instead/);
});

test('stock balances are derived from ledger movements', () => {
  assert.match(sql, /CREATE OR REPLACE VIEW v_stock_balance/);
  assert.match(sql, /SUM\(sl\.qty_in - sl\.qty_out\)/);
});

test('S3-1 seeds new permissions without overwriting existing grants', () => {
  assert.match(sql, /RECEIVE_STOCK/);
  assert.match(sql, /ENTER_CASE_USAGE/);
  const priorPermissions = fs.readFileSync(path.join(root, 'database', 'split', '18_roles_permissions.sql'), 'utf8');
  assert.match(priorPermissions, /APPROVE_STOCK_ADJUSTMENT/);
  assert.doesNotMatch(sql, /INSERT INTO system_permissions[^;]*APPROVE_STOCK_ADJUSTMENT/s);
  assert.match(sql, /ON CONFLICT \(role_name, permission_id\) DO NOTHING/);
});


test('stock balance view aggregates fallback UOM without breaking GROUP BY', () => {
  assert.match(sql, /COALESCE\(ci\.uom, ci\.unit, MIN\(sl\.uom\)\) AS uom/);
  assert.doesNotMatch(sql, /COALESCE\(ci\.uom, ci\.unit, sl\.uom\) AS uom/);
});

test('new migration is recorded after success and skipped on later startup', () => {
  assert.match(bootstrap, /app_migration_markers/);
  assert.match(bootstrap, /SELECT 1 FROM app_migration_markers WHERE marker_key = \$1/);
  assert.match(bootstrap, /already applied — skipped/);
  assert.match(bootstrap, /BEGIN/);
  assert.match(bootstrap, /COMMIT/);
  assert.match(bootstrap, /ROLLBACK/);
});
