'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

test('physical count route requires explicit adjustment approval permission', () => {
  const routes = fs.readFileSync(path.join(root, 'src/modules/stock/stockReceiving.routes.js'), 'utf8');
  assert.match(routes, /post\('\/physical-count'.*requirePermission\('APPROVE_STOCK_ADJUSTMENT'\)/);
  assert.match(routes, /countedQuantity: Joi\.number\(\)\.precision\(3\)\.min\(0\)/);
  assert.match(routes, /reason: Joi\.string\(\)\.trim\(\)\.min\(5\)/);
});

test('physical count writes approved immutable ADJUSTMENT ledger entries without mutating balances', () => {
  const service = fs.readFileSync(path.join(root, 'src/modules/stock/stockReceiving.service.js'), 'utf8');
  assert.match(service, /txn_type, qty_in, qty_out/);
  assert.match(service, /'ADJUSTMENT'/);
  assert.match(service, /approved_by, approved_at, approval_reason/);
  assert.match(service, /idempotency_key/);
  assert.match(service, /pg_advisory_xact_lock/);
  assert.doesNotMatch(service, /UPDATE\s+stock_ledger|DELETE\s+FROM\s+stock_ledger/i);
});

test('migration 30 seeds adjustment approval permission with default deny', () => {
  const migration = fs.readFileSync(path.join(root, 'database/split/30_stock_physical_count_permission.sql'), 'utf8');
  assert.match(migration, /APPROVE_STOCK_ADJUSTMENT/);
  assert.match(migration, /FALSE/);
  const init = fs.readFileSync(path.join(root, 'src/db/initializeDatabase.js'), 'utf8');
  assert.match(init, /2\[7-9\]\|30/);
});
