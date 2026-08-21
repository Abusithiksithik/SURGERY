/**
 * statistics.js
 * -----------------------------------------------------------------------
 * Pure, dependency-free statistical primitives used throughout the
 * Surgery Cost Intelligence engine. Every function accepts plain arrays
 * of numbers and returns numbers (or null when the input is empty),
 * so this module is trivially unit-testable and reusable from the
 * recommendation engine, alert engine, and dashboard aggregation layer.
 *
 * All functions treat `null`/`undefined`/`NaN` entries as missing data
 * and filter them out before computing, rather than throwing.
 * -----------------------------------------------------------------------
 */

'use strict';

/** Strip null/undefined/NaN and coerce to numbers. */
function clean(values) {
  return (values || [])
    .map((v) => (typeof v === 'string' ? parseFloat(v) : v))
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
}

function sum(values) {
  const v = clean(values);
  return v.reduce((a, b) => a + b, 0);
}

function mean(values) {
  const v = clean(values);
  if (v.length === 0) return null;
  return sum(v) / v.length;
}

function median(values) {
  return percentile(values, 50);
}

/** Mode: most frequently occurring value. Ties -> smallest value returned.
 *  For continuous cost data, callers typically bucket/round before calling this. */
function mode(values) {
  const v = clean(values);
  if (v.length === 0) return null;
  const freq = new Map();
  for (const n of v) freq.set(n, (freq.get(n) || 0) + 1);
  let best = null;
  let bestCount = -1;
  for (const [val, count] of freq.entries()) {
    if (count > bestCount || (count === bestCount && val < best)) {
      best = val;
      bestCount = count;
    }
  }
  return best;
}

function min(values) {
  const v = clean(values);
  return v.length ? Math.min(...v) : null;
}

function max(values) {
  const v = clean(values);
  return v.length ? Math.max(...v) : null;
}

function range(values) {
  const v = clean(values);
  if (v.length === 0) return null;
  return max(v) - min(v);
}

/** Sample variance (n-1 denominator) — standard for a historical sample, not a full population. */
function variance(values) {
  const v = clean(values);
  if (v.length < 2) return v.length === 1 ? 0 : null;
  const m = mean(v);
  const sq = v.reduce((acc, x) => acc + (x - m) ** 2, 0);
  return sq / (v.length - 1);
}

function stddev(values) {
  const varr = variance(values);
  return varr === null ? null : Math.sqrt(varr);
}

/**
 * Linear-interpolation percentile (matches PostgreSQL's percentile_cont
 * so Node-side and SQL-side numbers agree when both are used).
 * @param {number[]} values
 * @param {number} p - percentile, 0-100
 */
function percentile(values, p) {
  const v = clean(values).sort((a, b) => a - b);
  if (v.length === 0) return null;
  if (v.length === 1) return v[0];
  const rank = (p / 100) * (v.length - 1);
  const lowerIdx = Math.floor(rank);
  const upperIdx = Math.ceil(rank);
  if (lowerIdx === upperIdx) return v[lowerIdx];
  const weight = rank - lowerIdx;
  return v[lowerIdx] * (1 - weight) + v[upperIdx] * weight;
}

/** Interquartile range: { q1, q3, iqr } */
function interquartileRange(values) {
  const q1 = percentile(values, 25);
  const q3 = percentile(values, 75);
  if (q1 === null || q3 === null) return { q1: null, q3: null, iqr: null };
  return { q1, q3, iqr: q3 - q1 };
}

/**
 * Simple moving average over a series (e.g. monthly cost/profit series).
 * @param {number[]} values - ordered chronologically
 * @param {number} window
 * @returns {(number|null)[]} same length as input; first (window-1) entries are null
 */
function movingAverage(values, window = 3) {
  const v = clean(values);
  const out = new Array(v.length).fill(null);
  for (let i = window - 1; i < v.length; i++) {
    const slice = v.slice(i - window + 1, i + 1);
    out[i] = mean(slice);
  }
  return out;
}

/**
 * Trend analysis via simple linear regression (ordinary least squares).
 * X is assumed to be 0..n-1 (equally spaced periods, e.g. months).
 * @returns {{slope: number, intercept: number, direction: 'UP'|'DOWN'|'FLAT', r2: number}|null}
 */
function trendAnalysis(values) {
  const v = clean(values);
  const n = v.length;
  if (n < 2) return null;

  const xs = Array.from({ length: n }, (_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(v);

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (v[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  // R^2 goodness of fit
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssTot += (v[i] - yMean) ** 2;
    ssRes += (v[i] - predicted) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  const relativeSlope = yMean !== 0 ? Math.abs(slope / yMean) : Math.abs(slope);
  const direction = relativeSlope < 0.01 ? 'FLAT' : slope > 0 ? 'UP' : 'DOWN';

  return { slope, intercept, direction, r2 };
}

/**
 * Forecast the next N periods using the linear trend line.
 * A thin, swappable baseline — see engine/README for the ML extension point.
 */
function forecastNext(values, periods = 1) {
  const t = trendAnalysis(values);
  if (!t) return [];
  const n = clean(values).length;
  const out = [];
  for (let i = 0; i < periods; i++) {
    out.push(t.slope * (n + i) + t.intercept);
  }
  return out;
}

/**
 * Produces the full statistical summary bundle used repeatedly across
 * the recommendation engine (surgeon fee, assistant cost, OT cost, etc).
 * This is the single function most callers should use.
 */
function summarize(values) {
  const v = clean(values);
  const { q1, q3, iqr } = interquartileRange(v);
  return {
    count: v.length,
    sum: v.length ? sum(v) : null,
    average: mean(v),
    median: median(v),
    mode: mode(v),
    min: min(v),
    max: max(v),
    range: range(v),
    stddev: stddev(v),
    variance: variance(v),
    q1,
    q3,
    iqr,
  };
}

module.exports = {
  clean,
  sum,
  mean,
  median,
  mode,
  min,
  max,
  range,
  variance,
  stddev,
  percentile,
  interquartileRange,
  movingAverage,
  trendAnalysis,
  forecastNext,
  summarize,
};
