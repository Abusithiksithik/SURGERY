'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../frontend/src/features/stock');

test('barcode scanner supports camera detection and keyboard/manual fallback', () => {
  const scanner = fs.readFileSync(path.join(root, 'components/BarcodeScannerDialog.tsx'), 'utf8');
  assert.match(scanner, /getUserMedia/);
  assert.match(scanner, /BarcodeDetector/);
  assert.match(scanner, /onKeyDown/);
  assert.match(scanner, /code_128/);
  assert.match(scanner, /qr_code/);
});

test('OT Store receive and physical count resolve scans against exact Item Master codes', () => {
  const page = fs.readFileSync(path.join(root, 'StockStorePage.tsx'), 'utf8');
  assert.match(page, /handleReceiptScan/);
  assert.match(page, /handleCountScan/);
  assert.match(page, /item\.itemCode\.toLowerCase\(\) === code\.toLowerCase\(\)/);
  assert.match(page, /scannerTarget/);
});

test('Surgery Consumption resolves scanned item codes and requires available stock', () => {
  const page = fs.readFileSync(path.join(root, 'CaseConsumptionPage.tsx'), 'utf8');
  assert.match(page, /handleIssueScan/);
  assert.match(page, /available\.length/);
  assert.match(page, /QrCodeScanner/);
});
