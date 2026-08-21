'use strict';

const { query, queryOne, queryRows, withTransaction } = require('../../config/db');

function isMatviewError(err) {
  return err.code === '42P01' || err.code === '55000';
}
const ApiError = require('../../utils/ApiError');
const { alertEngine } = require('../../engine');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function toRow(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[snakeToCamel(k)] = v;
  return out;
}

async function loadThresholdConfig(branchId) {
  const rows = await queryRows(
    `SELECT * FROM alert_thresholds
     WHERE is_active = true AND (branch_id = $1 OR branch_id IS NULL)`,
    [branchId]
  );
  const config = {};
  for (const row of rows.filter((r) => r.branch_id === null)) {
    config[row.alert_type] = { yellow: Number(row.yellow_threshold_pct), red: Number(row.red_threshold_pct) };
  }
  for (const row of rows.filter((r) => r.branch_id === branchId)) {
    config[row.alert_type] = { yellow: Number(row.yellow_threshold_pct), red: Number(row.red_threshold_pct) };
  }
  return config;
}

async function loadBenchmark(surgeonId, surgeryTypeId) {
  let surgeonRows = [];
  let typeRows = [];
  try {
    surgeonRows = await queryRows(
      `SELECT avg_fee, avg_duration_minutes FROM mv_surgeon_stats WHERE surgeon_id = $1 AND surgery_type_id = $2`,
      [surgeonId, surgeryTypeId]
    );
    typeRows = await queryRows(
      `SELECT avg_actual_cost, avg_margin_pct FROM mv_surgery_type_stats WHERE surgery_type_id = $1`,
      [surgeryTypeId]
    );
  } catch (err) {
    if (!isMatviewError(err)) throw err;
    // matviews not yet populated — return empty benchmark (alerts use defaults)
  }
  const surgeonRow = surgeonRows[0] || {};
  const typeRow = typeRows[0] || {};
  return {
    avgSurgeonFee: n(surgeonRow.avg_fee),
    avgDurationMinutes: n(surgeonRow.avg_duration_minutes),
    avgMarginPct: n(typeRow.avg_margin_pct),
    avgAssistantCost: undefined,
    avgOTCost: undefined,
    avgConsumablesCost: undefined,
  };
}

function n(v) { return v === null || v === undefined ? undefined : Number(v); }

async function evaluateForSurgery(surgeryId) {
  const row = await queryOne(
    `SELECT s.*, COALESCE(sat.assistant_count,0) AS assistant_count,
            COALESCE(sat.total_assistant_cost,0) AS total_assistant_cost
     FROM surgeries s
     LEFT JOIN v_surgery_assistant_totals sat ON sat.surgery_id = s.surgery_id
     WHERE s.surgery_id = $1`,
    [surgeryId]
  );
  if (!row) throw ApiError.notFound('Surgery not found');

  const consumableRows = await queryRows(
    'SELECT SUM(total_cost) AS total FROM surgery_consumables WHERE surgery_id = $1',
    [surgeryId]
  );
  const consumablesCost = Number(consumableRows[0]?.total) || 0;

  const [benchmark, thresholds] = await Promise.all([
    loadBenchmark(row.surgeon_id, row.surgery_type_id),
    loadThresholdConfig(row.branch_id),
  ]);

  const surgeryView = {
    status: row.status,
    surgeonFee: n(row.actual_surgeon_fee) ?? n(row.budget_surgeon_fee),
    assistantCost: Number(row.total_assistant_cost) || n(row.budget_assistant_cost),
    durationMinutes: row.duration_minutes,
    otCost: n(row.actual_ot_cost) ?? n(row.budget_ot_cost),
    consumablesCost: consumablesCost || n(row.budget_consumables),
    quotedPrice: n(row.quoted_price),
    profit: n(row.profit_amount),
    marginPct: row.quoted_price && row.profit_amount != null
      ? (Number(row.profit_amount) / Number(row.quoted_price)) * 100 : undefined,
    actualTotal: n(row.actual_total),
    budgetTotal: n(row.budget_total),
    collectedAmount: n(row.collected_amount),
  };

  const alerts = alertEngine.evaluateAlerts(surgeryView, benchmark, {}, thresholds);

  await withTransaction(async (client) => {
    await client.query(
      'DELETE FROM surgery_alerts WHERE surgery_id = $1 AND is_acknowledged = false',
      [surgeryId]
    );
    for (const a of alerts) {
      await client.query(
        `INSERT INTO surgery_alerts (surgery_id, alert_type, severity, message, metric_value, threshold_value)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [surgeryId, a.type, a.severity, a.message, a.metricValue ?? null, a.thresholdValue ?? null]
      );
    }
  });

  return { surgeryId, overallSeverity: alertEngine.overallSeverity(alerts), alerts };
}

async function list(queryParams) {
  const { page, limit, skip, take } = parsePagination(queryParams);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (queryParams.severity) { conditions.push(`sa.severity = $${idx++}`); params.push(queryParams.severity); }
  if (queryParams.alertType) { conditions.push(`sa.alert_type = $${idx++}`); params.push(queryParams.alertType); }
  if (queryParams.isAcknowledged !== undefined) {
    conditions.push(`sa.is_acknowledged = $${idx++}`);
    params.push(queryParams.isAcknowledged === 'true' || queryParams.isAcknowledged === true);
  }
  if (queryParams.branchId) { conditions.push(`s.branch_id = $${idx++}`); params.push(queryParams.branchId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(
    `SELECT COUNT(*) FROM surgery_alerts sa JOIN surgeries s ON s.surgery_id = sa.surgery_id ${where}`,
    params
  );
  const totalCount = parseInt(countRes.rows[0].count, 10);

  params.push(take, skip);
  const rows = await queryRows(
    `SELECT sa.*, s.branch_id, s.surgeon_id, s.surgery_type_id, s.patient_id,
            p.full_name AS patient_name, p.mr_number,
            sg.full_name AS surgeon_name, st.name AS surgery_type_name
     FROM surgery_alerts sa
     JOIN surgeries s ON s.surgery_id = sa.surgery_id
     JOIN patients p ON p.patient_id = s.patient_id
     JOIN surgeons sg ON sg.surgeon_id = s.surgeon_id
     JOIN surgery_types st ON st.surgery_type_id = s.surgery_type_id
     ${where}
     ORDER BY CASE sa.severity WHEN 'RED' THEN 1 WHEN 'YELLOW' THEN 2 ELSE 3 END, sa.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  const items = rows.map((row) => {
    const alert = toRow(row);
    alert.surgery = {
      surgeryId: row.surgery_id,
      branchId: row.branch_id,
      patient: { fullName: row.patient_name, mrNumber: row.mr_number },
      surgeon: { fullName: row.surgeon_name },
      surgeryType: { name: row.surgery_type_name },
    };
    return alert;
  });

  return { items, meta: buildPaginationMeta({ page, limit, totalCount }) };
}

async function acknowledge(alertId, userId) {
  const row = await queryOne('SELECT alert_id FROM surgery_alerts WHERE alert_id = $1', [alertId]);
  if (!row) throw ApiError.notFound('Alert not found');
  const { rows } = await query(
    `UPDATE surgery_alerts SET is_acknowledged = true, acknowledged_by = $1, acknowledged_at = now()
     WHERE alert_id = $2 RETURNING *`,
    [userId, alertId]
  );
  return toRow(rows[0]);
}

async function listThresholds(branchId) {
  const rows = branchId
    ? await queryRows(
        `SELECT * FROM alert_thresholds WHERE branch_id = $1 OR branch_id IS NULL ORDER BY alert_type`,
        [branchId]
      )
    : await queryRows('SELECT * FROM alert_thresholds ORDER BY alert_type');
  return rows.map(toRow);
}

async function upsertThreshold(data, userId) {
  const branchId = data.branchId ?? null;
  const existing = await queryOne(
    'SELECT threshold_id FROM alert_thresholds WHERE (branch_id = $1 OR (branch_id IS NULL AND $1 IS NULL)) AND alert_type = $2',
    [branchId, data.alertType]
  );
  if (existing) {
    const { rows } = await query(
      `UPDATE alert_thresholds SET yellow_threshold_pct = $1, red_threshold_pct = $2, updated_by = $3, updated_at = now()
       WHERE threshold_id = $4 RETURNING *`,
      [data.yellowThresholdPct, data.redThresholdPct, userId, existing.threshold_id]
    );
    return toRow(rows[0]);
  }
  const { rows } = await query(
    `INSERT INTO alert_thresholds (branch_id, alert_type, yellow_threshold_pct, red_threshold_pct, updated_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [branchId, data.alertType, data.yellowThresholdPct, data.redThresholdPct, userId]
  );
  return toRow(rows[0]);
}

module.exports = { evaluateForSurgery, list, acknowledge, listThresholds, upsertThreshold };
