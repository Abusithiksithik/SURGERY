'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectIQROutliers, detectZScoreOutliers, detectOutliers, partitionByOutlier } = require('../engine/outlierDetection');

test('IQR flags an extreme value beyond the Tukey fence', () => {
  const v = [10, 12, 11, 13, 12, 11, 100]; // 100 is way off
  const flags = detectIQROutliers(v);
  assert.equal(flags[flags.length - 1], true);
  assert.ok(flags.slice(0, -1).every((f) => f === false));
});

test('Z-score flags an extreme value beyond threshold', () => {
  const v = [10, 12, 11, 13, 12, 11, 100];
  const flags = detectZScoreOutliers(v, 2);
  assert.equal(flags[flags.length - 1], true);
});

test('combined detectOutliers "either" mode is at least as sensitive as each method alone', () => {
  const v = [10, 12, 11, 13, 12, 11, 100];
  const combined = detectOutliers(v, { mode: 'either' });
  assert.equal(combined[combined.length - 1].isOutlier, true);
});

test('no outliers in a tight, uniform dataset', () => {
  const v = [100, 101, 99, 100, 102, 98, 100];
  const combined = detectOutliers(v);
  assert.ok(combined.every((f) => f.isOutlier === false));
});

test('partitionByOutlier separates clean vs outlier records and preserves fields', () => {
  const records = [
    { id: 'a', cost: 100 },
    { id: 'b', cost: 105 },
    { id: 'c', cost: 98 },
    { id: 'd', cost: 5000 }, // outlier
  ];
  const { cleanRecords, outlierRecords } = partitionByOutlier(records, 'cost');
  assert.equal(cleanRecords.length, 3);
  assert.equal(outlierRecords.length, 1);
  assert.equal(outlierRecords[0].id, 'd');
  assert.ok(outlierRecords[0]._outlierReason);
});
