'use strict';

const { queryRows, query } = require('../../config/db');
const { statistics } = require('../../engine');

/** 42P01 = relation not found; 55000 = matview not populated (created WITH NO DATA) */
function isMatviewError(err) {
  return err.code === '42P01' || err.code === '55000';
}

/** Safe queryRows that returns [] if a materialized view doesn't exist yet */
async function safeQueryRows(sql, params) {
  try {
    return await queryRows(sql, params);
  } catch (err) {
    if (isMatviewError(err)) return [];
    throw err;
  }
}

async function surgeonDashboard({ surgeonId, surgeryTypeId }) {
  const rows = await safeQueryRows(
    `SELECT ms.surgeon_id, s.full_name AS surgeon_name, ms.surgery_type_id, st.name AS surgery_type_name,
            ms.case_count, ms.avg_fee, ms.median_fee, ms.min_fee, ms.max_fee, ms.stddev_fee,
            ms.avg_profit, ms.avg_margin_pct, ms.avg_duration_minutes, ms.last_surgery_date
     FROM mv_surgeon_stats ms
     JOIN surgeons s ON s.surgeon_id = ms.surgeon_id
     JOIN surgery_types st ON st.surgery_type_id = ms.surgery_type_id
     WHERE ($1::uuid IS NULL OR ms.surgeon_id = $1::uuid)
       AND ($2::uuid IS NULL OR ms.surgery_type_id = $2::uuid)
     ORDER BY ms.case_count DESC`,
    [surgeonId || null, surgeryTypeId || null]
  );

  const monthlyTrend = surgeonId ? await surgeonMonthlyTrend(surgeonId) : [];
  return { benchmarks: rows, monthlyTrend };
}

async function surgeonMonthlyTrend(surgeonId) {
  const rows = await safeQueryRows(
    `SELECT date_trunc('month', surgery_date)::date AS month,
            COUNT(*) AS case_count,
            AVG(profit_amount) AS avg_profit,
            AVG(margin_pct) AS avg_margin_pct
     FROM v_completed_surgeries
     WHERE surgeon_id = $1
     GROUP BY 1 ORDER BY 1`,
    [surgeonId]
  );
  const profitSeries = rows.map((r) => Number(r.avg_profit) || 0);
  const trend = statistics.trendAnalysis(profitSeries);
  return { series: rows, trend };
}

async function surgeryTypeDashboard({ surgeryTypeId }) {
  const rows = await safeQueryRows(
    `SELECT ms.surgery_type_id, st.name AS surgery_type_name,
            ms.case_count, ms.avg_budget, ms.avg_actual_cost, ms.avg_quote,
            ms.avg_profit, ms.avg_margin_pct, ms.avg_duration_minutes, ms.median_actual_cost
     FROM mv_surgery_type_stats ms
     JOIN surgery_types st ON st.surgery_type_id = ms.surgery_type_id
     WHERE ($1::uuid IS NULL OR ms.surgery_type_id = $1::uuid)
     ORDER BY ms.case_count DESC`,
    [surgeryTypeId || null]
  );

  let extremes = {};
  if (surgeryTypeId) {
    const [mostExpensive, mostProfitable, lowestMargin] = await Promise.all([
      safeQueryRows(`SELECT surgery_id, surgery_date, actual_total FROM v_completed_surgeries WHERE surgery_type_id = $1 ORDER BY actual_total DESC NULLS LAST LIMIT 1`, [surgeryTypeId]),
      safeQueryRows(`SELECT surgery_id, surgery_date, profit_amount FROM v_completed_surgeries WHERE surgery_type_id = $1 ORDER BY profit_amount DESC NULLS LAST LIMIT 1`, [surgeryTypeId]),
      safeQueryRows(`SELECT surgery_id, surgery_date, margin_pct FROM v_completed_surgeries WHERE surgery_type_id = $1 ORDER BY margin_pct ASC NULLS LAST LIMIT 1`, [surgeryTypeId]),
    ]);
    extremes = {
      mostExpensiveSurgery: mostExpensive[0] || null,
      mostProfitableSurgery: mostProfitable[0] || null,
      lowestMarginSurgery: lowestMargin[0] || null,
    };
  }
  return { benchmarks: rows, ...extremes };
}

async function anaesthetistDashboard({ anaesthetistId }) {
  const rows = await safeQueryRows(
    `SELECT ma.anaesthetist_id, a.full_name AS anaesthetist_name, ma.anaesthesia_type,
            ma.case_count, ma.avg_fee, ma.median_fee, ma.min_fee, ma.max_fee, ma.stddev_fee
     FROM mv_anaesthetist_stats ma
     JOIN anaesthetists a ON a.anaesthetist_id = ma.anaesthetist_id
     WHERE ($1::uuid IS NULL OR ma.anaesthetist_id = $1::uuid)
     ORDER BY ma.case_count DESC`,
    [anaesthetistId || null]
  );
  return { benchmarks: rows };
}

async function otDashboard({ surgeryTypeId, otRoomId }) {
  const rows = await safeQueryRows(
    `SELECT mo.surgery_type_id, st.name AS surgery_type_name, mo.ot_room_id, r.room_name,
            mo.case_count, mo.avg_duration_minutes, mo.median_duration_minutes,
            mo.min_duration_minutes, mo.max_duration_minutes, mo.avg_ot_cost, mo.avg_cost_per_minute
     FROM mv_ot_stats mo
     JOIN surgery_types st ON st.surgery_type_id = mo.surgery_type_id
     LEFT JOIN ot_rooms r ON r.ot_room_id = mo.ot_room_id
     WHERE ($1::uuid IS NULL OR mo.surgery_type_id = $1::uuid)
       AND ($2::uuid IS NULL OR mo.ot_room_id = $2::uuid)
     ORDER BY mo.case_count DESC`,
    [surgeryTypeId || null, otRoomId || null]
  );
  return { benchmarks: rows };
}

async function refresh() {
  await query('SELECT fn_refresh_benchmark_views()');
  return { refreshedAt: new Date().toISOString() };
}

module.exports = { surgeonDashboard, surgeryTypeDashboard, anaesthetistDashboard, otDashboard, refresh };
