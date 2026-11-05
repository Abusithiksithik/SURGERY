'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('stock item picker query does not hide active items with missing UOM', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/stock/stockReceiving.service.js'), 'utf8');
  assert.match(source, /WHERE ci\.is_active = TRUE/);
  assert.doesNotMatch(source, /WHERE ci\.is_active = TRUE AND COALESCE\(NULLIF\(ci\.uom/);
});
