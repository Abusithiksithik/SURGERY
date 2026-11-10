const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
test('OT fixed-stock and expiry alert migration is additive and idempotent', () => {
  const sql = fs.readFileSync(path.join(root, 'database/split/32_ot_fixed_stock_and_alert_closures.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ot_fixed_stock_targets/);
  assert.match(sql, /UNIQUE \(item_id, location_id\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ot_stock_alert_closures/);
  assert.match(sql, /GENERATED ALWAYS AS \(COALESCE\(batch_number, ''\)\) STORED/);
  assert.match(sql, /MANAGE_OT_FIXED_STOCK/);
  assert.match(sql, /CLOSE_STOCK_ALERTS/);
});
test('OT dashboard alert queries use live stock ledger balances and three-month expiry window', () => {
  const service = fs.readFileSync(path.join(root, 'src/modules/dashboard/dashboard.service.js'), 'utf8');
  assert.match(service, /FROM v_stock_balance/);
  assert.match(service, /FROM stock_ledger sl/);
  assert.match(service, /INTERVAL '3 months'/);
  assert.match(service, /ot_stock_alert_closures/);
  assert.match(service, /COALESCE\(b\.on_hand_qty,0\) <> t\.fixed_qty/);
});
test('OT dashboard alert migration is discovered and tracked at startup', () => {
  const init = fs.readFileSync(path.join(root, 'src/db/initializeDatabase.js'), 'utf8');
  assert.match(init, /3\[0-9\]/);
  assert.match(init, /readdirSync/);
  assert.match(init, /2\[7-9\]\|3\[0-9\]/);
});

test('OT expiry alert query resolves location code from stock_locations, not v_stock_balance', () => {
  const service = fs.readFileSync(path.join(root, 'src/modules/dashboard/dashboard.service.js'), 'utf8');
  assert.match(service, /JOIN stock_locations l ON l\.location_id=b\.location_id/);
  assert.match(service, /l\.location_code/);
  assert.doesNotMatch(service, /b\.location_code/);
});
