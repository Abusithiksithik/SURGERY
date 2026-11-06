'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const uuid = require('../../src/modules/stock/uuid.validation');

test('accepts legacy seeded PostgreSQL UUID identifiers regardless of version bits', () => {
  const legacySurgeryId = '11000000-0000-0000-0000-000000000002';
  assert.equal(uuid.validate(legacySurgeryId).error, undefined);
});

test('rejects malformed UUID identifiers', () => {
  assert.ok(uuid.validate('not-a-uuid').error);
});
