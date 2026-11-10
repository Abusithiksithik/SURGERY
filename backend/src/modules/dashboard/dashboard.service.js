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


async function otFixedStockAlerts() {
  return queryRows(
    `SELECT t.target_id, t.item_id, t.location_id, ci.item_code, ci.item_name,
            l.location_code, l.location_name, t.fixed_qty,
            COALESCE(b.on_hand_qty, 0)::NUMERIC(14,3) AS on_hand_qty,
            (COALESCE(b.on_hand_qty, 0) - t.fixed_qty)::NUMERIC(14,3) AS difference,
            GREATEST(COALESCE(m.last_movement_at, t.updated_at), t.updated_at) AS mismatch_since,
            CASE WHEN now() - GREATEST(COALESCE(m.last_movement_at, t.updated_at), t.updated_at) > INTERVAL '24 hours'
                 THEN 'RED' ELSE 'YELLOW' END AS severity,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (INTERVAL '24 hours' -
              (now() - GREATEST(COALESCE(m.last_movement_at, t.updated_at), t.updated_at)))) / 3600))::int AS hours_left,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - GREATEST(COALESCE(m.last_movement_at, t.updated_at), t.updated_at)) -
              INTERVAL '24 hours') / 3600))::int AS hours_overdue
       FROM ot_fixed_stock_targets t
       JOIN consumable_items ci ON ci.item_id=t.item_id
       JOIN stock_locations l ON l.location_id=t.location_id
       LEFT JOIN (
         SELECT item_id, location_id, SUM(on_hand_qty)::NUMERIC(14,3) AS on_hand_qty
         FROM v_stock_balance GROUP BY item_id, location_id
       ) b ON b.item_id=t.item_id AND b.location_id=t.location_id
       LEFT JOIN LATERAL (
         SELECT MAX(entered_at) AS last_movement_at FROM stock_ledger sl
          WHERE sl.item_id=t.item_id AND sl.location_id=t.location_id
       ) m ON TRUE
      WHERE t.is_active=TRUE AND ci.is_active=TRUE
        AND COALESCE(b.on_hand_qty,0) <> t.fixed_qty
      ORDER BY CASE WHEN now()-GREATEST(COALESCE(m.last_movement_at,t.updated_at),t.updated_at)>INTERVAL '24 hours' THEN 0 ELSE 1 END,
               ci.item_name LIMIT 500`
  );
}

async function otExpiryAlerts() {
  return queryRows(
    `SELECT b.item_id, b.item_code, b.item_name, ci.category, b.location_id, l.location_code,
            b.batch_number, b.expiry_date, b.on_hand_qty,
            (b.expiry_date - (now() AT TIME ZONE 'Asia/Kolkata')::date)::int AS days_left,
            CASE WHEN b.expiry_date < (now() AT TIME ZONE 'Asia/Kolkata')::date
                 THEN 'EXPIRED' ELSE 'EXPIRING_SOON' END AS status
       FROM v_stock_balance b
       JOIN consumable_items ci ON ci.item_id=b.item_id
       JOIN stock_locations l ON l.location_id=b.location_id
      WHERE b.on_hand_qty > 0 AND b.expiry_date IS NOT NULL
        AND b.expiry_date <= (now() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '3 months'
        AND NOT EXISTS (
          SELECT 1 FROM ot_stock_alert_closures c
           WHERE c.item_id=b.item_id AND c.location_id=b.location_id
             AND c.batch_number IS NOT DISTINCT FROM b.batch_number
             AND c.expiry_date=b.expiry_date
        )
      ORDER BY b.expiry_date, b.item_name LIMIT 1000`
  );
}

async function closedOtExpiryAlerts() {
  return queryRows(
    `SELECT c.closure_id, c.item_id, c.location_id, c.batch_number, c.expiry_date,
            c.remarks, c.closed_at, ci.item_code, ci.item_name, l.location_code
       FROM ot_stock_alert_closures c
       JOIN consumable_items ci ON ci.item_id=c.item_id
       JOIN stock_locations l ON l.location_id=c.location_id
      ORDER BY c.closed_at DESC LIMIT 200`
  );
}

async function listFixedStockTargets() {
  return queryRows(
    `SELECT t.target_id, t.item_id, t.location_id, t.fixed_qty, t.is_active,
            ci.item_code, ci.item_name, l.location_code, l.location_name
       FROM ot_fixed_stock_targets t
       JOIN consumable_items ci ON ci.item_id=t.item_id
       JOIN stock_locations l ON l.location_id=t.location_id
      ORDER BY l.location_name, ci.item_name`
  );
}

async function saveFixedStockTarget({ itemId, locationId, fixedQty, userId }) {
  const rows = await queryRows(
    `INSERT INTO ot_fixed_stock_targets(item_id,location_id,fixed_qty,configured_by)
     SELECT ci.item_id, sl.location_id, $3, $4
       FROM consumable_items ci CROSS JOIN stock_locations sl
      WHERE ci.item_id=$1 AND ci.is_active=TRUE AND sl.location_id=$2 AND sl.is_active=TRUE
     ON CONFLICT(item_id,location_id) DO UPDATE
       SET fixed_qty=EXCLUDED.fixed_qty, is_active=TRUE, configured_by=EXCLUDED.configured_by, updated_at=now()
     RETURNING target_id,item_id,location_id,fixed_qty,is_active`,
    [itemId, locationId, fixedQty, userId]
  );
  if (!rows.length) { const e = new Error('Active item or OT store location not found'); e.statusCode=404; throw e; }
  return rows[0];
}

async function closeOtExpiryAlert({ itemId, locationId, batchNumber, expiryDate, remarks, userId, scope = 'BATCH' }) {
  if (scope === 'CATEGORY') {
    const rows = await queryRows(
      `INSERT INTO ot_stock_alert_closures(item_id,location_id,batch_number,expiry_date,remarks,closed_by)
       SELECT b.item_id,b.location_id,b.batch_number,b.expiry_date,$3,$4
         FROM v_stock_balance b
         JOIN consumable_items ci ON ci.item_id=b.item_id
        WHERE ci.category=(SELECT category FROM consumable_items WHERE item_id=$1)
          AND b.location_id=$2 AND b.on_hand_qty>0 AND b.expiry_date IS NOT NULL
          AND b.expiry_date <= (now() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '3 months'
       ON CONFLICT(item_id,location_id,batch_key,expiry_date) DO NOTHING
       RETURNING closure_id`,
      [itemId, locationId, remarks, userId]
    );
    if (!rows.length) { const e = new Error('No open expiry alerts found for this category'); e.statusCode=409; throw e; }
    return { closedCount: rows.length, scope: 'CATEGORY' };
  }
  const rows = await queryRows(
    `INSERT INTO ot_stock_alert_closures(item_id,location_id,batch_number,expiry_date,remarks,closed_by)
     SELECT b.item_id,b.location_id,b.batch_number,b.expiry_date,$5,$6
       FROM v_stock_balance b
      WHERE b.item_id=$1 AND b.location_id=$2
        AND b.batch_number IS NOT DISTINCT FROM $3::varchar
        AND b.expiry_date=$4::date AND b.on_hand_qty>0
        AND b.expiry_date <= (now() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '3 months'
     ON CONFLICT(item_id,location_id,batch_key,expiry_date) DO NOTHING
     RETURNING closure_id`,
    [itemId, locationId, batchNumber || null, expiryDate, remarks, userId]
  );
  if (!rows.length) { const e = new Error('Active expiry alert not found or already closed'); e.statusCode=409; throw e; }
  return rows[0];
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
  otFixedStockAlerts,
  otExpiryAlerts,
  closedOtExpiryAlerts,
  listFixedStockTargets,
  saveFixedStockTarget,
  closeOtExpiryAlert,
};
