/**
 * recommendationEngine.js
 * -----------------------------------------------------------------------
 * Turns a set of historical, similarity-ranked completed surgeries into
 * the full budget recommendation described in the spec: per-component
 * (surgeon fee, assistant, anaesthetist, OT, consumables, pharmacy,
 * misc) statistics + an overall recommended budget/quote/margin.
 *
 * This module is transport-agnostic: it takes plain JS arrays (as
 * returned by fn_similar_surgeries(...) or an equivalent Prisma query)
 * and returns a plain JS object ready to persist into
 * budget_recommendations.engine_output and to send to the frontend.
 *
 * Recommendations NEVER mutate input records and NEVER write budget
 * fields directly — the caller (API layer) is responsible for showing
 * this as a suggestion and letting the user accept/override it.
 * -----------------------------------------------------------------------
 */

'use strict';

const stats = require('./statistics');
const { partitionByOutlier } = require('./outlierDetection');

/**
 * @typedef HistoricalCase
 * @property {string} surgeryId
 * @property {string} surgeryDate
 * @property {string} mrNumber
 * @property {string} patientName
 * @property {number} patientAge
 * @property {string} patientGender
 * @property {string} surgeonName
 * @property {string} surgeryTypeName
 * @property {string} anaesthetistName
 * @property {string} anaesthesiaType
 * @property {number} durationMinutes
 * @property {number} surgeonFee
 * @property {number} assistantCount
 * @property {number} assistantCost
 * @property {number} anaesthetistFee
 * @property {number} otCost
 * @property {number} consumablesCost
 * @property {Array<{itemName:string, cost:number}>} consumableItems
 * @property {number} pharmacyCost
 * @property {number} miscCost
 * @property {number} actualTotal
 * @property {number} quotedPrice
 * @property {number} collectedAmount
 * @property {number} profit
 * @property {number} marginPct
 * @property {number} similarityScore
 */

const round2 = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);

/** Generic "component recommendation" builder: full stats bundle + top-N similar. */
function buildComponentStats(cases, valueKey) {
  const values = cases.map((c) => c[valueKey]);
  const s = stats.summarize(values);
  return {
    average: round2(s.average),
    median: round2(s.median),
    min: round2(s.min),
    max: round2(s.max),
    stddev: round2(s.stddev),
    sampleSize: s.count,
  };
}

function mostFrequent(items) {
  const freq = new Map();
  for (const item of items) {
    if (!item) continue;
    freq.set(item, (freq.get(item) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

/**
 * Surgeon fee recommendation.
 */
function recommendSurgeonFee(cases) {
  const sortedByDate = [...cases].sort((a, b) => new Date(b.surgeryDate) - new Date(a.surgeryDate));
  const componentStats = buildComponentStats(cases, 'surgeonFee');
  const last = sortedByDate[0] ? round2(sortedByDate[0].surgeonFee) : null;

  return {
    ...componentStats,
    lastFee: last,
    avgProfit: round2(stats.mean(cases.map((c) => c.profit))),
    avgMarginPct: round2(stats.mean(cases.map((c) => c.marginPct))),
    avgDurationMinutes: round2(stats.mean(cases.map((c) => c.durationMinutes))),
    recommendedFee: componentStats.median ?? componentStats.average,
  };
}

/**
 * Assistant cost recommendation.
 */
function recommendAssistantCost(cases) {
  const componentStats = buildComponentStats(cases, 'assistantCost');
  const avgAssistantCount = round2(stats.mean(cases.map((c) => c.assistantCount)));
  const avgCostPerAssistant = round2(
    stats.mean(
      cases
        .filter((c) => c.assistantCount > 0)
        .map((c) => c.assistantCost / c.assistantCount)
    )
  );
  // "Most frequently used assistants" requires per-assistant names, which
  // the caller passes separately (flattened) since a case can have many.
  return {
    ...componentStats,
    avgAssistantCount,
    avgCostPerAssistant,
    recommendedBudget: componentStats.median ?? componentStats.average,
  };
}

/**
 * Anaesthetist recommendation, plus a breakdown by anaesthesia type.
 */
function recommendAnaesthetistFee(cases) {
  const componentStats = buildComponentStats(cases, 'anaesthetistFee');
  const mostFrequentAnaesthetist = mostFrequent(cases.map((c) => c.anaesthetistName))[0] || null;

  const byType = {};
  for (const c of cases) {
    const key = c.anaesthesiaType || 'UNSPECIFIED';
    if (!byType[key]) byType[key] = [];
    byType[key].push(c.anaesthetistFee);
  }
  const avgFeeByType = Object.fromEntries(
    Object.entries(byType).map(([type, values]) => [type, round2(stats.mean(values))])
  );

  return {
    ...componentStats,
    mostFrequentAnaesthetist,
    avgFeeByAnaesthesiaType: avgFeeByType,
    recommendedBudget: componentStats.median ?? componentStats.average,
  };
}

/**
 * OT recommendation: duration + cost.
 */
function recommendOT(cases) {
  const durationStats = buildComponentStats(cases, 'durationMinutes');
  const costStats = buildComponentStats(cases, 'otCost');
  const costPerMinuteValues = cases
    .filter((c) => c.durationMinutes > 0)
    .map((c) => c.otCost / c.durationMinutes);

  return {
    expectedDurationMinutes: durationStats.median ?? durationStats.average,
    durationStats,
    costStats,
    avgCostPerMinute: round2(stats.mean(costPerMinuteValues)),
    recommendedBudget: costStats.median ?? costStats.average,
  };
}

/**
 * Consumables recommendation: overall spend stats + top cost drivers
 * across the flattened item list from all similar cases.
 */
function recommendConsumables(cases) {
  const componentStats = buildComponentStats(cases, 'consumablesCost');

  const itemTotals = new Map();
  for (const c of cases) {
    for (const item of c.consumableItems || []) {
      itemTotals.set(item.itemName, (itemTotals.get(item.itemName) || 0) + item.cost);
    }
  }
  const topCostDrivers = [...itemTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([itemName, totalCost]) => ({ itemName, totalCost: round2(totalCost) }));

  return {
    ...componentStats,
    topCostDrivers,
    recommendedBudget: componentStats.median ?? componentStats.average,
  };
}

/** Pharmacy recommendation (same shape as misc — simple spend stats). */
function recommendPharmacy(cases) {
  const componentStats = buildComponentStats(cases, 'pharmacyCost');
  return { ...componentStats, recommendedBudget: componentStats.median ?? componentStats.average };
}

/** Miscellaneous recommendation. */
function recommendMiscellaneous(cases) {
  const componentStats = buildComponentStats(cases, 'miscCost');
  return { ...componentStats, recommendedBudget: componentStats.median ?? componentStats.average };
}

/**
 * Top-level entry point. Takes the raw (already similarity-ranked)
 * candidate cases for a target profile and produces the complete
 * recommendation bundle.
 *
 * @param {HistoricalCase[]} allSimilarCases - as many as were fetched
 *        (e.g. all cases matching surgery type, ranked by similarity)
 * @param {object} opts
 * @param {boolean} opts.excludeOutliers - default true
 * @param {number} opts.targetMarginPct - desired margin %, for quote calc (default: historical avg margin)
 * @returns {object} full recommendation bundle
 */
function generateRecommendation(allSimilarCases, opts = {}) {
  const { excludeOutliers = true, targetMarginPct = null } = opts;

  // Outlier detection runs on total actual cost — a case that's an
  // outlier on overall cost is excluded from every component calc, to
  // keep all component recommendations internally consistent.
  const { cleanRecords, outlierRecords } = partitionByOutlier(
    allSimilarCases,
    'actualTotal',
    { mode: 'either' }
  );

  const workingSet = excludeOutliers ? cleanRecords : allSimilarCases;
  const last10Similar = [...allSimilarCases]
    .sort((a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0))
    .slice(0, 10);

  if (workingSet.length === 0) {
    return {
      sampleSize: 0,
      outliersExcluded: excludeOutliers,
      outlierCount: outlierRecords.length,
      warning: 'No historical data available for this surgeon/surgery-type combination. Recommendation cannot be generated — manual entry required.',
      last10SimilarSurgeries: last10Similar,
    };
  }

  const surgeonFee = recommendSurgeonFee(workingSet);
  const assistant = recommendAssistantCost(workingSet);
  const anaesthetist = recommendAnaesthetistFee(workingSet);
  const ot = recommendOT(workingSet);
  const consumables = recommendConsumables(workingSet);
  const pharmacy = recommendPharmacy(workingSet);
  const misc = recommendMiscellaneous(workingSet);

  const recommendedTotal = round2(
    (surgeonFee.recommendedFee || 0) +
      (assistant.recommendedBudget || 0) +
      (anaesthetist.recommendedBudget || 0) +
      (ot.recommendedBudget || 0) +
      (consumables.recommendedBudget || 0) +
      (pharmacy.recommendedBudget || 0) +
      (misc.recommendedBudget || 0)
  );

  const historicalAvgMargin = stats.mean(workingSet.map((c) => c.marginPct));
  const marginToUse = targetMarginPct ?? historicalAvgMargin ?? 0;

  // quote = cost / (1 - margin%) so that (quote - cost)/quote == margin%
  const marginFraction = Math.min(Math.max(marginToUse / 100, 0), 0.95); // safety clamp
  const recommendedQuote = round2(
    marginFraction < 1 ? recommendedTotal / (1 - marginFraction) : recommendedTotal
  );
  const recommendedProfit = round2(recommendedQuote - recommendedTotal);
  const recommendedProfitPct = recommendedQuote
    ? round2((recommendedProfit / recommendedQuote) * 100)
    : null;

  return {
    sampleSize: workingSet.length,
    outliersExcluded: excludeOutliers,
    outlierCount: outlierRecords.length,
    components: {
      surgeonFee,
      assistant,
      anaesthetist,
      ot,
      consumables,
      pharmacy,
      miscellaneous: misc,
    },
    overall: {
      recommendedSurgeonFee: surgeonFee.recommendedFee,
      recommendedAssistantBudget: assistant.recommendedBudget,
      recommendedAnaesthetistBudget: anaesthetist.recommendedBudget,
      recommendedOTBudget: ot.recommendedBudget,
      recommendedOTDurationMinutes: round2(ot.expectedDurationMinutes),
      recommendedConsumables: consumables.recommendedBudget,
      recommendedPharmacy: pharmacy.recommendedBudget,
      recommendedMiscellaneous: misc.recommendedBudget,
      recommendedTotalCost: recommendedTotal,
      recommendedMarginPct: round2(marginToUse),
      recommendedPatientQuote: recommendedQuote,
      recommendedProfit,
      recommendedProfitPct,
      recommendedCollectionTarget: recommendedQuote,
    },
    last10SimilarSurgeries: last10Similar,
  };
}

module.exports = {
  generateRecommendation,
  recommendSurgeonFee,
  recommendAssistantCost,
  recommendAnaesthetistFee,
  recommendOT,
  recommendConsumables,
  recommendPharmacy,
  recommendMiscellaneous,
};
