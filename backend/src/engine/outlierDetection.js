/**
 * outlierDetection.js
 * -----------------------------------------------------------------------
 * Flags abnormal historical cases so they can be excluded from
 * recommendation calculations by default (per spec: "Ignore abnormal
 * cases while generating recommendations. Use: IQR AND Z-Score. Mark
 * extreme values. Allow Admin to include/exclude outliers.")
 *
 * Design decision: a value is flagged as an outlier if EITHER method
 * flags it (IQR OR Z-score) — this is the more conservative, safer
 * default for a cost-recommendation system, since missing a genuine
 * outlier is worse than being slightly over-cautious. Each flag's
 * source is reported so the UI/admin can see *why* something was
 * flagged, and the combined rule is configurable via `mode`.
 * -----------------------------------------------------------------------
 */

'use strict';

const stats = require('./statistics');

/**
 * IQR-based outlier detection.
 * Flags any value outside [Q1 - k*IQR, Q3 + k*IQR]. k defaults to 1.5
 * (standard Tukey fence).
 */
function detectIQROutliers(values, k = 1.5) {
  const cleaned = stats.clean(values);
  const { q1, q3, iqr } = stats.interquartileRange(cleaned);
  if (q1 === null || iqr === null) {
    return cleaned.map(() => false);
  }
  const lowerFence = q1 - k * iqr;
  const upperFence = q3 + k * iqr;
  return cleaned.map((v) => v < lowerFence || v > upperFence);
}

/**
 * Z-score based outlier detection.
 * Flags any value whose |z| exceeds the threshold (default 3 = ~99.7%
 * of a normal distribution).
 */
function detectZScoreOutliers(values, threshold = 3) {
  const cleaned = stats.clean(values);
  const m = stats.mean(cleaned);
  const sd = stats.stddev(cleaned);
  if (m === null || sd === null || sd === 0) {
    return cleaned.map(() => false);
  }
  return cleaned.map((v) => Math.abs((v - m) / sd) > threshold);
}

/**
 * Combines both methods per-value.
 * @param {number[]} values
 * @param {object} opts
 * @param {number} opts.iqrK - Tukey fence multiplier (default 1.5)
 * @param {number} opts.zThreshold - z-score cutoff (default 3)
 * @param {'either'|'both'} opts.mode - 'either' (default, conservative) or
 *        'both' (only flag if IQR AND Z-score agree — more permissive)
 * @returns {{value:number, isOutlier:boolean, flaggedByIQR:boolean, flaggedByZScore:boolean}[]}
 */
function detectOutliers(values, opts = {}) {
  const { iqrK = 1.5, zThreshold = 3, mode = 'either' } = opts;
  const cleaned = stats.clean(values);
  const iqrFlags = detectIQROutliers(cleaned, iqrK);
  const zFlags = detectZScoreOutliers(cleaned, zThreshold);

  return cleaned.map((value, i) => {
    const flaggedByIQR = iqrFlags[i];
    const flaggedByZScore = zFlags[i];
    const isOutlier =
      mode === 'both' ? flaggedByIQR && flaggedByZScore : flaggedByIQR || flaggedByZScore;
    return { value, isOutlier, flaggedByIQR, flaggedByZScore };
  });
}

/**
 * Convenience: given an array of {id, value} records, returns
 * { clean: [...ids], outliers: [...ids], details: [...] }
 * Use this when filtering full surgery records before computing
 * recommendation statistics.
 */
function partitionByOutlier(records, valueKey, opts = {}) {
  const values = records.map((r) => r[valueKey]);
  const flags = detectOutliers(values, opts);

  // Note: detectOutliers drops non-finite values via stats.clean, so we
  // need to re-align by filtering records the same way first.
  const validRecords = records.filter((r) => {
    const v = r[valueKey];
    return typeof v === 'number' && Number.isFinite(v);
  });

  const cleanRecords = [];
  const outlierRecords = [];
  validRecords.forEach((record, i) => {
    const flag = flags[i];
    if (flag && flag.isOutlier) {
      outlierRecords.push({ ...record, _outlierReason: flag.flaggedByIQR && flag.flaggedByZScore
        ? 'IQR + Z-score'
        : flag.flaggedByIQR ? 'IQR fence' : 'Z-score' });
    } else {
      cleanRecords.push(record);
    }
  });

  return { cleanRecords, outlierRecords };
}

module.exports = {
  detectIQROutliers,
  detectZScoreOutliers,
  detectOutliers,
  partitionByOutlier,
};
