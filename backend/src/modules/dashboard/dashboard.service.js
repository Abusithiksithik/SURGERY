'use strict';

const { queryRows, query } = require('../../config/db');
const { statistics } = require('../../engine');

/** Identifies PostgreSQL errors from missing or unpopulated materialized views.
 * 42P01 = relation does not exist
 * 55000 = object_not_in_prerequisite_state (matview created WITH NO DATA, never refreshed)
 */
function isMatviewError(err) {
  return err.code === '42P01' || err.code === '55000';
}

async function summary({ branchId, departmentId, months }) {
  let rows = [];
  try {
    rows = await queryRows(
      `SELECT month, SUM(case_count) AS case_count, SUM(total_revenue) AS total_revenue,
              SUM(total_cost) AS total_cost, SUM(total_profit) AS total_profit,
              AVG(avg_margin_pct) AS avg_margin_pct, SUM(total_collected) AS total_collected
       FROM mv_monthly_financials
       WHERE ($1::uuid IS NULL OR branch_id = $1::uuid)
         AND ($2::uuid IS NULL OR department_id = $2::uuid)
         AND month >= date_trunc('month', now()) - ($3::int || ' months')::interval
       GROUP BY month ORDER BY month`,
      [branchId || null, departmentId || null, months]
    );
  } catch (err) {
    if (isMatviewError(err)) rows = []; // matview not yet created
    else throw err;
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.caseCount += Number(r.case_count) || 0;
      acc.totalRevenue += Number(r.total_revenue) || 0;
      acc.totalCost += Number(r.total_cost) || 0;
      acc.totalProfit += Number(r.total_profit) || 0;
      acc.totalCollected += Number(r.total_collected) || 0;
      return acc;
    },
    { caseCount: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, totalCollected: 0 }
  );
  totals.overallMarginPct = totals.totalRevenue
    ? Math.round((totals.totalProfit / totals.totalRevenue) * 10000) / 100
    : null;
  totals.pendingCollection = totals.totalRevenue - totals.totalCollected;

  return { monthlyTrend: rows, kpis: totals };
}

async function topProfitable({ branchId, limit, dateFrom, dateTo }) {
  return topN('profit_amount', 'DESC', { branchId, limit, dateFrom, dateTo });
}

async function lowestMargin({ branchId, limit, dateFrom, dateTo }) {
  return topN('margin_pct', 'ASC', { branchId, limit, dateFrom, dateTo });
}

async function highestOtCost({ branchId, limit, dateFrom, dateTo }) {
  return topN('actual_ot_cost', 'DESC', { branchId, limit, dateFrom, dateTo });
}

async function highestAssistantCost({ branchId, limit, dateFrom, dateTo }) {
  try {
    return await queryRows(
      `SELECT v.surgery_id, v.surgery_date, v.surgeon_name, v.surgery_type_name,
              COALESCE(sat.total_assistant_cost, 0) AS value
       FROM v_completed_surgeries v
       LEFT JOIN v_surgery_assistant_totals sat ON sat.surgery_id = v.surgery_id
       WHERE ($1::uuid IS NULL OR v.branch_id = $1::uuid)
         AND ($2::date IS NULL OR v.surgery_date >= $2::date)
         AND ($3::date IS NULL OR v.surgery_date <= $3::date)
       ORDER BY value DESC NULLS LAST LIMIT $4::int`,
      [branchId || null, dateFrom || null, dateTo || null, limit]
    );
  } catch (err) {
    if (isMatviewError(err)) return [];
    throw err;
  }
}

async function highestConsumableCases({ branchId, limit, dateFrom, dateTo }) {
  return topN('actual_consumables', 'DESC', { branchId, limit, dateFrom, dateTo });
}

const ALLOWED_COLUMNS = ['profit_amount', 'margin_pct', 'actual_ot_cost', 'actual_consumables'];

async function topN(column, direction, { branchId, limit, dateFrom, dateTo }) {
  const dir = direction === 'ASC' ? 'ASC' : 'DESC';
  if (!ALLOWED_COLUMNS.includes(column)) throw new Error(`Invalid column: ${column}`);
  try {
    return await queryRows(
      `SELECT surgery_id, surgery_date, surgeon_name, surgery_type_name, ${column} AS value
       FROM v_completed_surgeries
       WHERE ($1::uuid IS NULL OR branch_id = $1::uuid)
         AND ($2::date IS NULL OR surgery_date >= $2::date)
         AND ($3::date IS NULL OR surgery_date <= $3::date)
       ORDER BY ${column} ${dir} NULLS LAST LIMIT $4::int`,
      [branchId || null, dateFrom || null, dateTo || null, limit]
    );
  } catch (err) {
    if (isMatviewError(err)) return [];
    throw err;
  }
}

async function departmentComparison({ branchId, months }) {
  try {
    return await queryRows(
      `SELECT d.department_name, mf.department_id,
              SUM(mf.case_count) AS case_count, SUM(mf.total_revenue) AS total_revenue,
              SUM(mf.total_cost) AS total_cost, SUM(mf.total_profit) AS total_profit,
              AVG(mf.avg_margin_pct) AS avg_margin_pct
       FROM mv_monthly_financials mf
       JOIN departments d ON d.department_id = mf.department_id
       WHERE ($1::uuid IS NULL OR mf.branch_id = $1::uuid)
         AND mf.month >= date_trunc('month', now()) - ($2::int || ' months')::interval
       GROUP BY d.department_name, mf.department_id
       ORDER BY total_revenue DESC`,
      [branchId || null, months || 12]
    );
  } catch (err) {
    if (isMatviewError(err)) return [];
    throw err;
  }
}

async function branchComparison({ months }) {
  try {
    return await queryRows(
      `SELECT b.branch_name, mf.branch_id,
              SUM(mf.case_count) AS case_count, SUM(mf.total_revenue) AS total_revenue,
              SUM(mf.total_cost) AS total_cost, SUM(mf.total_profit) AS total_profit,
              AVG(mf.avg_margin_pct) AS avg_margin_pct
       FROM mv_monthly_financials mf
       JOIN branches b ON b.branch_id = mf.branch_id
       WHERE mf.month >= date_trunc('month', now()) - ($1::int || ' months')::interval
       GROUP BY b.branch_name, mf.branch_id
       ORDER BY total_revenue DESC`,
      [months || 12]
    );
  } catch (err) {
    if (isMatviewError(err)) return [];
    throw err;
  }
}

async function doctorComparison({ branchId, months }) {
  try {
    return await queryRows(
      `SELECT s.full_name AS surgeon_name, ms.surgeon_id,
              SUM(ms.case_count) AS case_count, AVG(ms.avg_fee) AS avg_fee,
              AVG(ms.avg_profit) AS avg_profit, AVG(ms.avg_margin_pct) AS avg_margin_pct
       FROM mv_surgeon_stats ms
       JOIN surgeons s ON s.surgeon_id = ms.surgeon_id
       WHERE ($1::uuid IS NULL OR s.branch_id = $1::uuid)
       GROUP BY s.full_name, ms.surgeon_id
       ORDER BY case_count DESC`,
      [branchId || null]
    );
  } catch (err) {
    if (isMatviewError(err)) return [];
    throw err;
  }
}

async function forecast({ branchId, metric, periods }) {
  const columnMap = { revenue: 'total_revenue', cost: 'total_cost', profit: 'total_profit' };
  const column = columnMap[metric] || 'total_revenue';
  if (!Object.values(columnMap).includes(column)) throw new Error('Invalid metric');

  // Guard: return empty forecast if the materialized view doesn't exist yet
  // (first-boot before schema is fully applied, or after a manual DROP)
  let rows = [];
  try {
    rows = await queryRows(
      `SELECT month, SUM(${column}) AS value
       FROM mv_monthly_financials
       WHERE ($1::uuid IS NULL OR branch_id = $1::uuid)
       GROUP BY month ORDER BY month`,
      [branchId || null]
    );
  } catch (err) {
    if (isMatviewError(err)) {
      // relation does not exist — return empty result gracefully
      return { metric, historical: [], trend: null, forecast: [] };
    }
    throw err;
  }

  const series = rows.map((r) => Number(r.value) || 0);
  const trendResult = statistics.trendAnalysis(series);
  const forecastValues = statistics.forecastNext(series, periods);

  return {
    metric,
    historical: rows,
    trend: trendResult,
    forecast: forecastValues.map((value, i) => ({
      periodsAhead: i + 1,
      projectedValue: Math.round(value * 100) / 100,
    })),
  };
}

module.exports = {
  summary,
  topProfitable,
  lowestMargin,
  highestOtCost,
  highestAssistantCost,
  highestConsumableCases,
  departmentComparison,
  branchComparison,
  doctorComparison,
  forecast,
};
