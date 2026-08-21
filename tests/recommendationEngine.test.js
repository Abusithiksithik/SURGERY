'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateRecommendation } = require('../engine/recommendationEngine');
const { evaluateAlerts, overallSeverity, SEVERITY } = require('../engine/alertEngine');

function makeCase(overrides = {}) {
  return {
    surgeryId: 'S-' + Math.random().toString(36).slice(2),
    surgeryDate: '2026-01-01',
    mrNumber: 'MR001',
    patientName: 'Test Patient',
    surgeonFee: 15000,
    assistantCount: 1,
    assistantCost: 3000,
    anaesthetistFee: 5000,
    anaesthesiaType: 'GENERAL',
    anaesthetistName: 'Dr. A',
    durationMinutes: 90,
    otCost: 8000,
    consumablesCost: 4000,
    consumableItems: [{ itemName: 'Suture Kit', cost: 1500 }, { itemName: 'Gauze', cost: 500 }],
    pharmacyCost: 1000,
    miscCost: 500,
    actualTotal: 36500,
    quotedPrice: 50000,
    collectedAmount: 50000,
    profit: 13500,
    marginPct: 27,
    similarityScore: 65,
    ...overrides,
  };
}

test('generateRecommendation returns a warning when there is no historical data', () => {
  const result = generateRecommendation([]);
  assert.equal(result.sampleSize, 0);
  assert.ok(result.warning);
});

test('generateRecommendation produces sensible aggregate numbers on a clean sample', () => {
  const cases = [
    makeCase({ surgeonFee: 14000 }),
    makeCase({ surgeonFee: 15000 }),
    makeCase({ surgeonFee: 16000 }),
    makeCase({ surgeonFee: 15500 }),
  ];
  const result = generateRecommendation(cases, { excludeOutliers: true });

  assert.equal(result.sampleSize, 4);
  assert.ok(result.components.surgeonFee.average > 14000 && result.components.surgeonFee.average < 16000);
  assert.ok(result.overall.recommendedTotalCost > 0);
  assert.ok(result.overall.recommendedPatientQuote > result.overall.recommendedTotalCost);
  assert.equal(result.last10SimilarSurgeries.length, 4);
});

test('generateRecommendation excludes a strong outlier from component stats by default', () => {
  const cases = [
    makeCase({ actualTotal: 36000, surgeonFee: 15000 }),
    makeCase({ actualTotal: 37000, surgeonFee: 15200 }),
    makeCase({ actualTotal: 36500, surgeonFee: 14800 }),
    makeCase({ actualTotal: 400000, surgeonFee: 15000 }), // extreme total cost outlier
  ];
  const result = generateRecommendation(cases, { excludeOutliers: true });
  assert.equal(result.sampleSize, 3);
  assert.equal(result.outlierCount, 1);
});

test('generateRecommendation can include outliers when asked', () => {
  const cases = [
    makeCase({ actualTotal: 36000 }),
    makeCase({ actualTotal: 37000 }),
    makeCase({ actualTotal: 36500 }),
    makeCase({ actualTotal: 400000 }),
  ];
  const result = generateRecommendation(cases, { excludeOutliers: false });
  assert.equal(result.sampleSize, 4);
});

test('alertEngine flags negative profit and quote-too-low as RED', () => {
  const surgery = {
    surgeonFee: 15000,
    assistantCost: 3000,
    durationMinutes: 90,
    otCost: 8000,
    consumablesCost: 4000,
    quotedPrice: 20000,
    recommendedTotalCost: 30000,
    profit: -10000,
    marginPct: -50,
    collectedAmount: 0,
  };
  const alerts = evaluateAlerts(surgery, {}, { minMarginPct: 20 });
  const types = alerts.map((a) => a.type);
  assert.ok(types.includes('NEGATIVE_PROFIT'));
  assert.ok(types.includes('QUOTE_TOO_LOW'));
  assert.equal(overallSeverity(alerts), SEVERITY.RED);
});

test('alertEngine stays green when everything is within benchmark range', () => {
  const surgery = {
    surgeonFee: 15000,
    assistantCost: 3000,
    durationMinutes: 90,
    otCost: 8000,
    consumablesCost: 4000,
    quotedPrice: 50000,
    recommendedTotalCost: 33000,
    profit: 17000,
    marginPct: 34,
    collectedAmount: 50000,
    status: 'COMPLETED',
    actualTotal: 33000,
    budgetTotal: 34000,
  };
  const benchmark = {
    avgSurgeonFee: 15200,
    avgAssistantCost: 3100,
    avgDurationMinutes: 92,
    avgOTCost: 8100,
    avgConsumablesCost: 4050,
    avgMarginPct: 30,
  };
  const alerts = evaluateAlerts(surgery, benchmark, { minMarginPct: 20 });
  assert.equal(overallSeverity(alerts), SEVERITY.GREEN);
});

test('alertEngine flags surgeon fee significantly above historical average', () => {
  const surgery = { surgeonFee: 25000 }; // 66% above benchmark
  const benchmark = { avgSurgeonFee: 15000 };
  const alerts = evaluateAlerts(surgery, benchmark);
  const feeAlert = alerts.find((a) => a.type === 'SURGEON_FEE_HIGH');
  assert.ok(feeAlert);
  assert.equal(feeAlert.severity, SEVERITY.RED);
});
