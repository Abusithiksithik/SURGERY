/**
 * alertEngine.js
 * -----------------------------------------------------------------------
 * Evaluates a surgery (budget/actual/quote) against historical benchmarks
 * and configurable thresholds to produce color-coded alerts, matching
 * the spec's alert list and Green/Yellow/Red indicator system.
 *
 * Thresholds are passed in (loaded by the caller from the
 * `alert_thresholds` table) rather than hardcoded, so Admins can tune
 * them per branch without a code change.
 * -----------------------------------------------------------------------
 */

'use strict';

const SEVERITY = Object.freeze({ GREEN: 'GREEN', YELLOW: 'YELLOW', RED: 'RED' });

const DEFAULT_THRESHOLDS = Object.freeze({
  SURGEON_FEE_HIGH: { yellow: 15, red: 20 },
  ASSISTANT_COST_HIGH: { yellow: 18, red: 25 },
  OT_DURATION_LONG: { yellow: 15, red: 30 },
  OT_COST_HIGH: { yellow: 15, red: 25 },
  CONSUMABLES_HIGH: { yellow: 15, red: 25 },
  MARGIN_BELOW_TARGET: { yellow: 10, red: 20 }, // % points below target margin
});

function pctDeviation(actual, benchmark) {
  if (benchmark === null || benchmark === undefined || benchmark === 0) return null;
  return ((actual - benchmark) / benchmark) * 100;
}

function severityForDeviation(deviationPct, thresholds) {
  if (deviationPct === null) return null;
  const abs = Math.abs(deviationPct);
  if (abs >= thresholds.red) return SEVERITY.RED;
  if (abs >= thresholds.yellow) return SEVERITY.YELLOW;
  return SEVERITY.GREEN;
}

/**
 * @param {object} surgery - the case being evaluated (actuals/budget/quote)
 * @param {object} benchmark - historical averages for this surgeon/type from the engine
 * @param {object} targets - business targets, e.g. { minMarginPct: 20 }
 * @param {object} thresholdConfig - overrides for DEFAULT_THRESHOLDS
 * @returns {Array<{type, severity, message, metricValue, thresholdValue}>}
 */
function evaluateAlerts(surgery, benchmark = {}, targets = {}, thresholdConfig = {}) {
  const th = { ...DEFAULT_THRESHOLDS, ...thresholdConfig };
  const alerts = [];

  const pushDeviationAlert = (type, actual, benchmarkValue, label) => {
    if (actual === null || actual === undefined) return;
    const dev = pctDeviation(actual, benchmarkValue);
    const sev = severityForDeviation(dev, th[type]);
    if (sev && sev !== SEVERITY.GREEN) {
      alerts.push({
        type,
        severity: sev,
        message: `${label} is ${dev.toFixed(1)}% ${dev > 0 ? 'above' : 'below'} the historical average (₹${benchmarkValue?.toFixed?.(2) ?? benchmarkValue}).`,
        metricValue: actual,
        thresholdValue: benchmarkValue,
      });
    }
  };

  pushDeviationAlert('SURGEON_FEE_HIGH', surgery.surgeonFee, benchmark.avgSurgeonFee, 'Surgeon fee');
  pushDeviationAlert('ASSISTANT_COST_HIGH', surgery.assistantCost, benchmark.avgAssistantCost, 'Assistant cost');
  pushDeviationAlert('OT_DURATION_LONG', surgery.durationMinutes, benchmark.avgDurationMinutes, 'OT duration');
  pushDeviationAlert('OT_COST_HIGH', surgery.otCost, benchmark.avgOTCost, 'OT cost');
  pushDeviationAlert('CONSUMABLES_HIGH', surgery.consumablesCost, benchmark.avgConsumablesCost, 'Consumables cost');

  // Margin below target
  const minMargin = targets.minMarginPct ?? benchmark.avgMarginPct;
  if (surgery.marginPct !== null && surgery.marginPct !== undefined && minMargin != null) {
    const gap = minMargin - surgery.marginPct; // positive = below target
    if (gap >= th.MARGIN_BELOW_TARGET.red) {
      alerts.push({
        type: 'MARGIN_BELOW_TARGET',
        severity: SEVERITY.RED,
        message: `Profit margin (${surgery.marginPct.toFixed(1)}%) is critically below the target of ${minMargin.toFixed(1)}%.`,
        metricValue: surgery.marginPct,
        thresholdValue: minMargin,
      });
    } else if (gap >= th.MARGIN_BELOW_TARGET.yellow) {
      alerts.push({
        type: 'MARGIN_BELOW_TARGET',
        severity: SEVERITY.YELLOW,
        message: `Profit margin (${surgery.marginPct.toFixed(1)}%) is below the target of ${minMargin.toFixed(1)}%.`,
        metricValue: surgery.marginPct,
        thresholdValue: minMargin,
      });
    }
  }

  // Quoted price too low (quote below recommended total cost)
  if (surgery.quotedPrice != null && surgery.recommendedTotalCost != null) {
    if (surgery.quotedPrice < surgery.recommendedTotalCost) {
      alerts.push({
        type: 'QUOTE_TOO_LOW',
        severity: SEVERITY.RED,
        message: `Quoted price (₹${surgery.quotedPrice}) is below the recommended cost (₹${surgery.recommendedTotalCost}) — this case will run at a loss.`,
        metricValue: surgery.quotedPrice,
        thresholdValue: surgery.recommendedTotalCost,
      });
    }
  }

  // Negative profit
  if (surgery.profit != null && surgery.profit < 0) {
    alerts.push({
      type: 'NEGATIVE_PROFIT',
      severity: SEVERITY.RED,
      message: `This surgery has a negative profit of ₹${surgery.profit}.`,
      metricValue: surgery.profit,
      thresholdValue: 0,
    });
  }

  // Budget exceeded
  if (surgery.actualTotal != null && surgery.budgetTotal != null) {
    if (surgery.actualTotal > surgery.budgetTotal) {
      const over = ((surgery.actualTotal - surgery.budgetTotal) / surgery.budgetTotal) * 100;
      alerts.push({
        type: 'BUDGET_EXCEEDED',
        severity: over > 20 ? SEVERITY.RED : SEVERITY.YELLOW,
        message: `Actual cost exceeded budget by ${over.toFixed(1)}%.`,
        metricValue: surgery.actualTotal,
        thresholdValue: surgery.budgetTotal,
      });
    }
  }

  // Actual cost missing on a completed surgery
  if (surgery.status === 'COMPLETED' && (surgery.actualTotal === null || surgery.actualTotal === undefined)) {
    alerts.push({
      type: 'ACTUAL_COST_MISSING',
      severity: SEVERITY.YELLOW,
      message: 'This completed surgery has no actual cost recorded yet.',
      metricValue: null,
      thresholdValue: null,
    });
  }

  // Collection pending
  if (surgery.quotedPrice != null && surgery.collectedAmount != null) {
    const pendingAmount = surgery.quotedPrice - surgery.collectedAmount;
    if (pendingAmount > 0) {
      const pendingPct = (pendingAmount / surgery.quotedPrice) * 100;
      alerts.push({
        type: 'COLLECTION_PENDING',
        severity: pendingPct > 50 ? SEVERITY.RED : SEVERITY.YELLOW,
        message: `₹${pendingAmount.toFixed(2)} (${pendingPct.toFixed(1)}%) is still pending collection.`,
        metricValue: surgery.collectedAmount,
        thresholdValue: surgery.quotedPrice,
      });
    }
  }

  return alerts;
}

/** Rolls up a list of alerts into a single overall severity for card/badge display. */
function overallSeverity(alerts) {
  if (alerts.some((a) => a.severity === SEVERITY.RED)) return SEVERITY.RED;
  if (alerts.some((a) => a.severity === SEVERITY.YELLOW)) return SEVERITY.YELLOW;
  return SEVERITY.GREEN;
}

module.exports = {
  SEVERITY,
  DEFAULT_THRESHOLDS,
  pctDeviation,
  severityForDeviation,
  evaluateAlerts,
  overallSeverity,
};
