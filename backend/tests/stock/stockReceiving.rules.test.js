'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReceiptLines } = require('../../src/modules/stock/stockReceiving.rules');

test('accepts valid receipt lines', () => {
  const lines = [{ itemId: 'item-1', quantity: 2, unitCost: 10 }];
  assert.equal(validateReceiptLines(lines), lines);
});

test('rejects an empty receipt', () => {
  assert.throws(() => validateReceiptLines([]), /At least one stock receipt line/);
});

test('rejects zero or negative quantity', () => {
  assert.throws(() => validateReceiptLines([{ itemId: 'item-1', quantity: 0, unitCost: 1 }]), /positive quantity/);
  assert.throws(() => validateReceiptLines([{ itemId: 'item-1', quantity: -1, unitCost: 1 }]), /positive quantity/);
});

test('rejects negative or invalid unit cost', () => {
  assert.throws(() => validateReceiptLines([{ itemId: 'item-1', quantity: 1, unitCost: -1 }]), /valid non-negative unit cost/);
  assert.throws(() => validateReceiptLines([{ itemId: 'item-1', quantity: 1, unitCost: 'bad' }]), /valid non-negative unit cost/);
});

test('rejects duplicate item/batch/expiry/serial lines', () => {
  const line = { itemId: 'item-1', quantity: 1, unitCost: 5, batchNumber: 'B1' };
  assert.throws(() => validateReceiptLines([line, { ...line }]), /Duplicate receipt line/);
});

test('caps receipt lines at 200', () => {
  const lines = Array.from({ length: 201 }, (_, i) => ({ itemId: `item-${i}`, quantity: 1, unitCost: 0 }));
  assert.throws(() => validateReceiptLines(lines), /more than 200 lines/);
});
