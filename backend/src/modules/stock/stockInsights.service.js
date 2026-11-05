'use strict';

const { queryRows } = require('../../config/db');

async function movementReport(filters = {}) {
  const params = [];
  const where = [];
  if (filters.dateFrom) { params.push(filters.dateFrom); where.push(`sl.txn_date >= $${params.length}`); }
  if (filters.dateTo) { params.push(filters.dateTo); where.push(`sl.txn_date <= $${params.length}`); }
  if (filters.locationId) { params.push(filters.locationId); where.push(`sl.location_id = $${params.length}`); }
  if (filters.itemId) { params.push(filters.itemId); where.push(`sl.item_id = $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return queryRows(
    `SELECT sl.txn_date AS movement_date, sl.txn_type, ci.item_code, ci.item_name,
            sl.uom, l.location_code, SUM(sl.qty_in)::NUMERIC(14,3) AS qty_in,
            SUM(sl.qty_out)::NUMERIC(14,3) AS qty_out,
            SUM(sl.qty_in - sl.qty_out)::NUMERIC(14,3) AS net_qty,
            SUM(CASE WHEN sl.txn_type IN ('RECEIPT','OPENING') THEN sl.qty_in * COALESCE(sl.unit_cost,0) ELSE 0 END)::NUMERIC(14,2) AS received_value
       FROM stock_ledger sl
       JOIN consumable_items ci ON ci.item_id = sl.item_id
       JOIN stock_locations l ON l.location_id = sl.location_id
       ${clause}
      GROUP BY sl.txn_date, sl.txn_type, ci.item_code, ci.item_name, sl.uom, l.location_code
      ORDER BY sl.txn_date DESC, ci.item_name ASC
      LIMIT 5000`, params
  );
}

async function stockAlerts() {
  const low = await queryRows(
    `SELECT b.item_id, b.item_code, b.item_name, b.location_id, b.location_code,
            SUM(b.on_hand_qty)::NUMERIC(14,3) AS on_hand_qty,
            ci.reorder_level::NUMERIC(14,3) AS reorder_level, 'LOW_STOCK' AS alert_type
       FROM v_stock_balance b JOIN consumable_items ci ON ci.item_id=b.item_id
      WHERE ci.is_active=TRUE AND COALESCE(ci.reorder_level,0)>0
      GROUP BY b.item_id,b.item_code,b.item_name,b.location_id,b.location_code,ci.reorder_level
     HAVING SUM(b.on_hand_qty) <= ci.reorder_level
      ORDER BY b.item_name LIMIT 1000`
  );
  const expiry = await queryRows(
    `SELECT b.item_id,b.item_code,b.item_name,b.location_id,b.location_code,b.batch_number,
            b.expiry_date,b.on_hand_qty,
            CASE WHEN b.expiry_date < CURRENT_DATE THEN 'EXPIRED' ELSE 'EXPIRING_SOON' END AS alert_type
       FROM v_stock_balance b
      WHERE b.on_hand_qty > 0 AND b.expiry_date IS NOT NULL
        AND b.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY b.expiry_date,b.item_name LIMIT 1000`
  );
  const unbilled = await queryRows(
    `SELECT u.usage_id,u.surgery_id,s.surgery_number,ci.item_code,ci.item_name,
            u.quantity_issued,u.uom,u.issued_at
       FROM surgery_usage_lines u
       JOIN surgeries s ON s.surgery_id=u.surgery_id
       JOIN consumable_items ci ON ci.item_id=u.item_id
       LEFT JOIN pharmacy_billing_handover h ON h.usage_id=u.usage_id
      WHERE h.handover_id IS NULL
      ORDER BY u.issued_at DESC LIMIT 1000`
  );
  return { lowStock: low, expiry, unbilled };
}

module.exports = { movementReport, stockAlerts };
