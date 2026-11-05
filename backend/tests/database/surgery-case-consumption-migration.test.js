'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const sql = fs.readFileSync(path.join(root, 'database/split/29_surgery_case_consumption.sql'), 'utf8');
const init = fs.readFileSync(path.join(root, 'src/db/initializeDatabase.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'src/modules/stock/stockUsage.routes.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/modules/stock/stockUsage.service.js'), 'utf8');

test('S3-2 migration 29 is auto-discovered and uses the tracked migration runner', () => {
  assert.match(init, /2\[7-9\]\|30/);
  assert.ok(fs.existsSync(path.join(root, 'database/split/29_surgery_case_consumption.sql')));
  assert.match(sql, /surgery_usage_lines/);
});

test('case usage references existing surgery, item, location and immutable stock ledger', () => {
  assert.match(sql, /REFERENCES surgeries\(surgery_id\)/);
  assert.match(sql, /REFERENCES consumable_items\(item_id\)/);
  assert.match(sql, /REFERENCES stock_locations\(location_id\)/);
  assert.match(sql, /REFERENCES stock_ledger\(ledger_id\).*DEFERRABLE INITIALLY DEFERRED/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON surgery_usage_lines/);
});

test('wastage is recorded as a usage event and does not double-decrement stock', () => {
  assert.match(sql, /event_type IN \('RETURN','WASTAGE'\)/);
  assert.match(service, /isReturn\s*\?\s*'RETURN'\s*:\s*'WASTAGE'/);
  assert.match(service, /if \(isReturn\) \{/);
  assert.match(service, /surgery_usage_events\(idempotency_key,usage_id,event_type,quantity,ledger_id/);
});

test('usage routes enforce case usage and pharmacy handover permissions', () => {
  assert.match(routes, /requirePermission\('ENTER_CASE_USAGE'\)/);
  assert.match(routes, /requirePermission\('RECORD_PHARMACY_BILL'\)/);
  assert.match(routes, /router\.post\('\/issues'/);
  assert.match(routes, /pharmacy-handover/);
});

test('service blocks closed/cancelled cases and checks available stock before issue', () => {
  assert.match(service, /CLOSED_STATUSES = new Set\(\['CANCELLED', 'DELETED', 'CLOSED'\]\)/);
  assert.match(service, /Insufficient stock/);
  assert.match(service, /pg_advisory_xact_lock/);
});
