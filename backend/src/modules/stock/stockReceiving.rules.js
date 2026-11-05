'use strict';

const ApiError = require('../../utils/ApiError');

function validateReceiptLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw ApiError.badRequest('At least one stock receipt line is required.');
  }
  if (lines.length > 200) {
    throw ApiError.badRequest('A receipt cannot contain more than 200 lines.');
  }

  const seen = new Set();
  for (const [index, line] of lines.entries()) {
    const quantity = Number(line.quantity);
    const unitCost = Number(line.unitCost);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      throw ApiError.badRequest(`Receipt line ${index + 1} must have a positive quantity and a valid non-negative unit cost.`);
    }
    const key = [line.itemId, line.batchNumber || '', line.expiryDate || '', line.serialNumber || ''].join('|').toLowerCase();
    if (seen.has(key)) {
      throw ApiError.badRequest(`Duplicate receipt line ${index + 1}. Combine identical item/batch/expiry/serial lines.`);
    }
    seen.add(key);
  }
  return lines;
}

module.exports = { validateReceiptLines };
