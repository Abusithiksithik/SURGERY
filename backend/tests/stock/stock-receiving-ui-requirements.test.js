'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

test('Receive Stock UI exposes the requested indent, invoice, fixed-stock and refill fields', () => {
  const page = fs.readFileSync(path.join(root, '../frontend/src/features/stock/StockStorePage.tsx'), 'utf8');
  for (const label of ['Against Indent', 'Without indent (manual)', 'Invoice / Bill Number', 'Bill / Invoice upload', 'Fixed Qty', 'In OT now', 'Required to refill', 'Quantity received', 'Batch No', 'Expiry Date', 'Unit Cost']) {
    assert.ok(page.includes(label), `Missing Receive Stock field: ${label}`);
  }
  assert.match(page, /uploadReceiptInvoice\(payload\.receiptId, invoiceFile\)/);
});

test('receipt attachment migration is additive and keeps uploaded metadata append-only', () => {
  const sql = fs.readFileSync(path.join(root, 'database/split/34_stock_receipt_invoice_attachments.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS stock_receipt_attachments/);
  assert.match(sql, /REFERENCES stock_receipts\(receipt_id\) ON DELETE RESTRICT/);
  assert.match(sql, /application\/pdf/);
  assert.match(sql, /trg_stock_receipt_attachments_append_only/);
  const init = fs.readFileSync(path.join(root, 'src/db/initializeDatabase.js'), 'utf8');
  assert.match(init, /3\[0-9\]/);
});

test('receipt invoice upload is permission-protected and restricted to 10 MB PDF/image files', () => {
  const routes = fs.readFileSync(path.join(root, 'src/modules/stock/stockReceiving.routes.js'), 'utf8');
  assert.match(routes, /requirePermission\('RECEIVE_STOCK'\)/);
  assert.match(routes, /10 \* 1024 \* 1024/);
  assert.match(routes, /image\/jpeg/);
  assert.match(routes, /application\/pdf/);
});

 test('stock item picker returns the location-specific fixed quantity for Receive Stock', () => {
  const service = fs.readFileSync(path.join(root, 'src/modules/stock/stockReceiving.service.js'), 'utf8');
  assert.match(service, /COALESCE\(t\.fixed_qty, ci\.fixed_qty_in_ot, 0\) AS fixed_qty_in_ot/);
  assert.match(service, /t\.location_id=COALESCE\(\$1::uuid/);
});

test('Receive Stock uses an aggregate per-item balance query rather than a paginated batch list', () => {
  const service = fs.readFileSync(path.join(root, 'src/modules/stock/stockReceiving.service.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, '../frontend/src/features/stock/StockStorePage.tsx'), 'utf8');
  assert.match(service, /SUM\(on_hand_qty\).*GROUP BY item_id, location_id/s);
  assert.match(page, /stockApi\.balanceSummary\(locationId\)/);
});

test('Hospital dashboard uses live OT stock alerts and displays the real empty state', () => {
  const page = fs.readFileSync(path.join(root, '../frontend/src/features/dashboard/DashboardPage.tsx'), 'utf8');
  const panel = fs.readFileSync(path.join(root, '../frontend/src/features/dashboard/OtStockAlertsPanel.tsx'), 'utf8');
  assert.match(page, /<OtStockAlertsPanel \/>/);
  assert.match(panel, /dashboardApi\.getOtStockAlerts/);
  assert.match(panel, /No fixed stock targets configured yet/);
  assert.match(panel, /No expiry alerts in the next 3 months/);
});
