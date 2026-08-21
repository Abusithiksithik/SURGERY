'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const stats = require('../engine/statistics');

test('mean/median/mode/min/max basics', () => {
  const v = [10, 20, 20, 30, 40];
  assert.equal(stats.mean(v), 24);
  assert.equal(stats.median(v), 20);
  assert.equal(stats.mode(v), 20);
  assert.equal(stats.min(v), 10);
  assert.equal(stats.max(v), 40);
  assert.equal(stats.range(v), 30);
});

test('handles nulls/undefined/NaN gracefully', () => {
  const v = [10, null, undefined, NaN, 20];
  assert.equal(stats.mean(v), 15);
  assert.equal(stats.summarize([]).average, null);
  assert.equal(stats.summarize([]).count, 0);
});

test('stddev / variance sample formula (n-1)', () => {
  const v = [2, 4, 4, 4, 5, 5, 7, 9];
  // known population stddev = 2.0, sample stddev slightly higher
  const sd = stats.stddev(v);
  assert.ok(Math.abs(sd - 2.138) < 0.01);
});

test('percentile matches linear interpolation (percentile_cont style)', () => {
  const v = [1, 2, 3, 4];
  assert.equal(stats.percentile(v, 50), 2.5);
  assert.equal(stats.percentile(v, 0), 1);
  assert.equal(stats.percentile(v, 100), 4);
});

test('interquartile range', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  const { q1, q3, iqr } = stats.interquartileRange(v);
  assert.ok(Math.abs(q1 - 2.75) < 0.01);
  assert.ok(Math.abs(q3 - 6.25) < 0.01);
  assert.ok(Math.abs(iqr - 3.5) < 0.01);
});

test('moving average', () => {
  const v = [10, 20, 30, 40, 50];
  const ma = stats.movingAverage(v, 3);
  assert.deepEqual(ma, [null, null, 20, 30, 40]);
});

test('trend analysis detects upward trend', () => {
  const v = [100, 110, 120, 130, 140];
  const t = stats.trendAnalysis(v);
  assert.equal(t.direction, 'UP');
  assert.ok(t.slope > 0);
  assert.ok(t.r2 > 0.99);
});

test('trend analysis detects flat trend', () => {
  const v = [100, 101, 99, 100, 100];
  const t = stats.trendAnalysis(v);
  assert.equal(t.direction, 'FLAT');
});

test('forecastNext extrapolates linear trend', () => {
  const v = [10, 20, 30, 40];
  const forecast = stats.forecastNext(v, 2);
  assert.equal(forecast.length, 2);
  assert.ok(Math.abs(forecast[0] - 50) < 0.01);
  assert.ok(Math.abs(forecast[1] - 60) < 0.01);
});
