'use strict';

const { queryRows, query } = require('../../config/db');

function isMatviewError(err) {
  return err.code === '42P01' || err.code === '55000' || err.code === '42883';
}
const ApiError = require('../../utils/ApiError');

async function search(filters) {
  let rows = [];
  try {
    rows = await queryRows(
      `SELECT * FROM fn_similar_surgeries(
         $1::uuid, $2::uuid, $3::uuid, $4::varchar,
         NULL::gender_type, NULL::varchar, $5::uuid, TRUE, 500::int
       )`,
      [
        filters.surgeryTypeId,
        filters.surgeonId || null,
        filters.anaesthetistId || null,
        null,
        filters.departmentId || null,
      ]
    );
  } catch (err) {
    if (!isMatviewError(err)) throw err;
    // view/function not yet created — return empty results
  }

  let candidates = rows.map(mapRow);

  if (filters.dateFrom) candidates = candidates.filter((c) => new Date(c.surgeryDate) >= new Date(filters.dateFrom));
  if (filters.dateTo) candidates = candidates.filter((c) => new Date(c.surgeryDate) <= new Date(filters.dateTo));
  if (filters.minProfit !== undefined) candidates = candidates.filter((c) => c.profit !== null && c.profit >= filters.minProfit);
  if (filters.maxProfit !== undefined) candidates = candidates.filter((c) => c.profit !== null && c.profit <= filters.maxProfit);
  if (filters.minDuration !== undefined) candidates = candidates.filter((c) => c.durationMinutes !== null && c.durationMinutes >= filters.minDuration);
  if (filters.maxDuration !== undefined) candidates = candidates.filter((c) => c.durationMinutes !== null && c.durationMinutes <= filters.maxDuration);
  if (filters.minCost !== undefined) candidates = candidates.filter((c) => c.actualTotal !== null && c.actualTotal >= filters.minCost);
  if (filters.maxCost !== undefined) candidates = candidates.filter((c) => c.actualTotal !== null && c.actualTotal <= filters.maxCost);

  const [sortField, sortDir] = (filters.sort || 'similarityScore:desc').split(':');
  candidates.sort((a, b) => {
    const av = a[sortField] ?? -Infinity;
    const bv = b[sortField] ?? -Infinity;
    if (sortField === 'surgeryDate') {
      return sortDir === 'asc' ? new Date(av) - new Date(bv) : new Date(bv) - new Date(av);
    }
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const totalCount = candidates.length;
  const start = (filters.page - 1) * filters.limit;
  const items = candidates.slice(start, start + filters.limit);

  return {
    items,
    meta: {
      page: filters.page,
      limit: filters.limit,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / filters.limit)),
    },
  };
}

async function compare(surgeryIds) {
  const { rows } = await query(
    `SELECT s.surgery_id, s.status, s.patient_age_years, s.patient_gender,
            s.scheduled_date, s.surgery_date, s.duration_minutes,
            s.budget_surgeon_fee, s.budget_assistant_cost, s.budget_anaesthetist_fee,
            s.budget_ot_cost, s.budget_consumables, s.budget_pharmacy,
            s.budget_miscellaneous, s.budget_total,
            s.actual_surgeon_fee, s.actual_assistant_cost, s.actual_anaesthetist_fee,
            s.actual_ot_cost, s.actual_consumables, s.actual_pharmacy,
            s.actual_miscellaneous, s.actual_total,
            s.quoted_price, s.collected_amount, s.profit_amount, s.is_outlier,
            p.patient_id, p.full_name AS patient_full_name, p.mr_number,
            sg.surgeon_id, sg.full_name AS surgeon_full_name,
            an.anaesthetist_id, an.full_name AS anaesthetist_full_name,
            st.surgery_type_id, st.name AS surgery_type_name,
            d.department_id, d.department_name
     FROM surgeries s
     JOIN patients p ON p.patient_id = s.patient_id
     JOIN surgeons sg ON sg.surgeon_id = s.surgeon_id
     LEFT JOIN anaesthetists an ON an.anaesthetist_id = s.anaesthetist_id
     JOIN surgery_types st ON st.surgery_type_id = s.surgery_type_id
     LEFT JOIN departments d ON d.department_id = s.department_id
     WHERE s.surgery_id = ANY($1::uuid[]) AND s.status = 'COMPLETED'`,
    [surgeryIds]
  );

  if (rows.length !== surgeryIds.length) {
    const foundIds = new Set(rows.map((s) => s.surgery_id));
    const missing = surgeryIds.filter((id) => !foundIds.has(id));
    throw ApiError.notFound(`Some surgeries were not found or are not completed: ${missing.join(', ')}`);
  }

  return rows.map((r) => ({
    surgeryId: r.surgery_id,
    status: r.status,
    patientAgeYears: r.patient_age_years,
    patientGender: r.patient_gender,
    scheduledDate: r.scheduled_date,
    surgeryDate: r.surgery_date,
    durationMinutes: r.duration_minutes,
    budgetSurgeonFee: numOrNull(r.budget_surgeon_fee),
    budgetAssistantCost: numOrNull(r.budget_assistant_cost),
    budgetAnaesthetistFee: numOrNull(r.budget_anaesthetist_fee),
    budgetOtCost: numOrNull(r.budget_ot_cost),
    budgetConsumables: numOrNull(r.budget_consumables),
    budgetPharmacy: numOrNull(r.budget_pharmacy),
    budgetMiscellaneous: numOrNull(r.budget_miscellaneous),
    budgetTotal: numOrNull(r.budget_total),
    actualSurgeonFee: numOrNull(r.actual_surgeon_fee),
    actualAssistantCost: numOrNull(r.actual_assistant_cost),
    actualAnaesthetistFee: numOrNull(r.actual_anaesthetist_fee),
    actualOtCost: numOrNull(r.actual_ot_cost),
    actualConsumables: numOrNull(r.actual_consumables),
    actualPharmacy: numOrNull(r.actual_pharmacy),
    actualMiscellaneous: numOrNull(r.actual_miscellaneous),
    actualTotal: numOrNull(r.actual_total),
    quotedPrice: numOrNull(r.quoted_price),
    collectedAmount: numOrNull(r.collected_amount),
    profitAmount: numOrNull(r.profit_amount),
    isOutlier: r.is_outlier,
    mrNumber: r.mr_number,
    patient: { patientId: r.patient_id, fullName: r.patient_full_name, mrNumber: r.mr_number },
    surgeon: { surgeonId: r.surgeon_id, fullName: r.surgeon_full_name },
    anaesthetist: r.anaesthetist_id ? { anaesthetistId: r.anaesthetist_id, fullName: r.anaesthetist_full_name } : null,
    surgeryType: { surgeryTypeId: r.surgery_type_id, name: r.surgery_type_name },
    department: r.department_id ? { departmentId: r.department_id, departmentName: r.department_name } : null,
  }));
}

function mapRow(r) {
  return {
    surgeryId: r.surgery_id,
    similarityScore: Number(r.similarity_score),
    surgeryDate: r.surgery_date,
    mrNumber: r.mr_number,
    patientName: r.patient_name,
    patientAgeYears: r.patient_age_years,
    patientGender: r.patient_gender,
    surgeonName: r.surgeon_name,
    surgeryTypeName: r.surgery_type_name,
    anaesthetistName: r.anaesthetist_name,
    durationMinutes: r.duration_minutes,
    surgeonFee: numOrNull(r.actual_surgeon_fee),
    assistantCost: numOrNull(r.total_assistant_cost),
    otCost: numOrNull(r.actual_ot_cost),
    consumablesCost: numOrNull(r.actual_consumables),
    miscCost: numOrNull(r.actual_miscellaneous),
    actualTotal: numOrNull(r.actual_total),
    quotedPrice: numOrNull(r.quoted_price),
    collectedAmount: numOrNull(r.collected_amount),
    profit: numOrNull(r.profit_amount),
    marginPct: numOrNull(r.margin_pct),
  };
}

function numOrNull(v) {
  return v === null || v === undefined ? null : Number(v);
}

module.exports = { search, compare };
