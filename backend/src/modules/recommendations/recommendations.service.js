'use strict';

const { queryRows, queryOne, query } = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const { recommendationEngine, similarity } = require('../../engine');

async function fetchSimilarCandidates(target, { sampleLimit = 200, weights = {} } = {}) {
  const ageGroup = target.patientAgeYears != null ? similarity.ageToGroup(target.patientAgeYears) : null;
  const w = { ...similarity.DEFAULT_WEIGHTS, ...weights };

  const rows = await queryRows(
    `SELECT * FROM fn_similar_surgeries(
       $1::uuid, $2::uuid, $3::uuid, $4::varchar, $5::gender_type, $6::varchar, $7::uuid,
       TRUE, $8::int, $9::numeric, $10::numeric, $11::numeric, $12::numeric, $13::numeric, $14::numeric, $15::numeric
     )`,
    [
      target.surgeryTypeId, target.surgeonId, target.anaesthetistId || null,
      ageGroup, target.patientGender || null, target.packageName || null, target.departmentId || null,
      sampleLimit,
      w.surgeonAndType, w.surgeryType, w.anaesthetist, w.ageGroup, w.gender, w.package, w.department,
    ]
  );

  if (rows.length === 0) return [];

  const surgeryIds = rows.map((r) => r.surgery_id);
  const consumableRows = await queryRows(
    `SELECT sc.surgery_id, ci.item_name, sc.total_cost
     FROM surgery_consumables sc
     JOIN consumable_items ci ON ci.item_id = sc.item_id
     WHERE sc.surgery_id = ANY($1::uuid[])`,
    [surgeryIds]
  );

  const consumablesBySurgery = new Map();
  for (const row of consumableRows) {
    const list = consumablesBySurgery.get(row.surgery_id) || [];
    list.push({ itemName: row.item_name, cost: Number(row.total_cost) });
    consumablesBySurgery.set(row.surgery_id, list);
  }

  return rows.map((r) => ({
    surgeryId: r.surgery_id,
    surgeryDate: r.surgery_date,
    mrNumber: r.mr_number,
    patientName: r.patient_name,
    patientAge: r.patient_age_years,
    patientGender: r.patient_gender,
    surgeonName: r.surgeon_name,
    surgeryTypeName: r.surgery_type_name,
    anaesthetistName: r.anaesthetist_name,
    anaesthesiaType: r.anaesthesia_type,
    durationMinutes: r.duration_minutes,
    surgeonFee: n(r.actual_surgeon_fee),
    assistantCount: Number(r.assistant_count) || 0,
    assistantCost: n(r.total_assistant_cost),
    anaesthetistFee: n(r.actual_anaesthetist_fee),
    otCost: n(r.actual_ot_cost),
    consumablesCost: n(r.actual_consumables),
    consumableItems: consumablesBySurgery.get(r.surgery_id) || [],
    pharmacyCost: n(r.actual_pharmacy),
    miscCost: n(r.actual_miscellaneous),
    actualTotal: n(r.actual_total),
    quotedPrice: n(r.quoted_price),
    collectedAmount: n(r.collected_amount),
    profit: n(r.profit_amount),
    marginPct: n(r.margin_pct),
    similarityScore: Number(r.similarity_score),
  }));
}

function n(v) { return v === null || v === undefined ? 0 : Number(v); }

async function preview(target, opts) {
  const candidates = await fetchSimilarCandidates(target, opts);
  const result = recommendationEngine.generateRecommendation(candidates, {
    excludeOutliers: opts.excludeOutliers,
    targetMarginPct: opts.targetMarginPct,
  });
  return { target, weightsUsed: { ...similarity.DEFAULT_WEIGHTS, ...opts.weights }, ...result };
}

async function generateForSurgery(surgeryId, opts, userId) {
  const surgery = await queryOne('SELECT * FROM surgeries WHERE surgery_id = $1', [surgeryId]);
  if (!surgery) throw ApiError.notFound('Surgery not found');

  const target = {
    surgeonId: surgery.surgeon_id,
    surgeryTypeId: surgery.surgery_type_id,
    anaesthetistId: surgery.anaesthetist_id,
    patientAgeYears: surgery.patient_age_years,
    patientGender: surgery.patient_gender,
    departmentId: surgery.department_id,
  };

  const candidates = await fetchSimilarCandidates(target, opts);
  const result = recommendationEngine.generateRecommendation(candidates, {
    excludeOutliers: opts.excludeOutliers,
    targetMarginPct: opts.targetMarginPct,
  });

  if (!opts.persist) {
    return { surgeryId, ...result };
  }

  const overall = result.overall || {};
  const { rows } = await query(
    `INSERT INTO budget_recommendations
     (surgery_id, generated_by, surgeon_id, surgery_type_id, anaesthetist_id,
      sample_size, outliers_excluded, similarity_weights,
      recommended_surgeon_fee, recommended_assistant_cost, recommended_anaesthetist_fee,
      recommended_ot_cost, recommended_ot_duration_minutes, recommended_consumables,
      recommended_pharmacy, recommended_miscellaneous, recommended_total,
      recommended_quote, recommended_margin_pct, engine_output)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     RETURNING recommendation_id`,
    [
      surgeryId, userId || null, target.surgeonId, target.surgeryTypeId, target.anaesthetistId || null,
      result.sampleSize, result.outliersExcluded ?? true,
      JSON.stringify({ ...similarity.DEFAULT_WEIGHTS, ...opts.weights }),
      overall.recommendedSurgeonFee ?? null,
      overall.recommendedAssistantBudget ?? null,
      overall.recommendedAnaesthetistBudget ?? null,
      overall.recommendedOTBudget ?? null,
      overall.recommendedOTDurationMinutes ?? null,
      overall.recommendedConsumables ?? null,
      overall.recommendedPharmacy ?? null,
      overall.recommendedMiscellaneous ?? null,
      overall.recommendedTotalCost ?? null,
      overall.recommendedPatientQuote ?? null,
      overall.recommendedMarginPct ?? null,
      JSON.stringify(result),
    ]
  );

  return { recommendationId: rows[0].recommendation_id, surgeryId, ...result };
}

async function getHistory(surgeryId) {
  const recs = await queryRows(
    'SELECT * FROM budget_recommendations WHERE surgery_id = $1 ORDER BY generated_at DESC',
    [surgeryId]
  );
  for (const rec of recs) {
    const overrides = await queryRows(
      'SELECT * FROM recommendation_overrides WHERE recommendation_id = $1',
      [rec.recommendation_id]
    );
    rec.overrides = overrides;
  }
  return recs;
}

async function getAcceptanceRate(filters = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.surgeonId) { conditions.push(`surgeon_id = $${idx++}`); params.push(filters.surgeonId); }
  if (filters.dateFrom) { conditions.push(`generated_at >= $${idx++}`); params.push(new Date(filters.dateFrom)); }
  if (filters.dateTo) { conditions.push(`generated_at <= $${idx++}`); params.push(new Date(filters.dateTo)); }
  if (filters.branchId) { conditions.push(`surgery_id IN (SELECT surgery_id FROM surgeries WHERE branch_id = $${idx++})`); params.push(filters.branchId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const recs = await queryRows(
    `SELECT recommendation_id FROM budget_recommendations ${where}`, params
  );

  const totalRecommendations = recs.length;
  if (totalRecommendations === 0) {
    return { totalRecommendations: 0, overriddenCount: 0, fullyAcceptedCount: 0, overallAcceptanceRatePct: null, byComponent: {} };
  }

  const recIds = recs.map((r) => r.recommendation_id);
  const overrideRows = await queryRows(
    'SELECT recommendation_id, component FROM recommendation_overrides WHERE recommendation_id = ANY($1::uuid[])',
    [recIds]
  );

  const overriddenRecs = new Set(overrideRows.map((o) => o.recommendation_id));
  const overriddenCount = overriddenRecs.size;

  const componentOverrideCounts = {};
  for (const o of overrideRows) {
    componentOverrideCounts[o.component] = (componentOverrideCounts[o.component] || 0) + 1;
  }

  const byComponent = Object.fromEntries(
    Object.entries(componentOverrideCounts).map(([component, count]) => [
      component,
      {
        overriddenCount: count,
        acceptanceRatePct: Math.round((1 - count / totalRecommendations) * 10000) / 100,
      },
    ])
  );

  return {
    totalRecommendations,
    overriddenCount,
    fullyAcceptedCount: totalRecommendations - overriddenCount,
    overallAcceptanceRatePct: Math.round((1 - overriddenCount / totalRecommendations) * 10000) / 100,
    byComponent,
  };
}

module.exports = { preview, generateForSurgery, getHistory, getAcceptanceRate, fetchSimilarCandidates };
