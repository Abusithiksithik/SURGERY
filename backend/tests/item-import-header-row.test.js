'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { collectRows, HEADER_ROW, FIRST_DATA_ROW } = require('../scripts/import-items');

test('OT stock importer reads category headings from row 2 and ignores row 1 note', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Masters');
  sheet.addRow(['Long workbook note: not a header']);
  sheet.addRow(['Billable', 'Non Billed Consumables', 'Suture Materials']);
  sheet.addRow(['Paracetamol Inj', 'Cotton Roll', 'Mersilk 2-0']);
  const rows = collectRows(workbook);
  assert.equal(HEADER_ROW, 2);
  assert.equal(FIRST_DATA_ROW, 3);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row.category), ['MEDICINE', 'NON_BILLED', 'SUTURE']);
  assert.ok(rows.every(row => row.header !== 'Long workbook note: not a header'));
});
