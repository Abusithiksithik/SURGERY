'use strict';

const { randomUUID } = require('crypto');
const { queryRows, queryOne, withTransaction } = require('../../config/db');
const ApiError = require('../../utils/ApiError');

const camel = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [
  key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()), value,
]));
const CLOSED_STATUSES = new Set(['CANCELLED', 'DELETED', 'CLOSED']);

async function findCase(search) {
  const term = String(search || '').trim();
  if (term.length < 2) return [];
  const rows = await queryRows(
    `SELECT s.surgery_id, s.surgery_number, s.status, s.surgery_date, s.scheduled_date,
            p.mr_number, p.full_name AS patient_name,
            st.name AS surgery_name
       FROM surgeries s
       JOIN patients p ON p.patient_id=s.patient_id
       LEFT JOIN surgery_types st ON st.surgery_type_id=s.surgery_type_id
      WHERE s.status <> 'DELETED'
        AND (s.surgery_number ILIKE $1 OR p.mr_number ILIKE $1 OR p.full_name ILIKE $1)
      ORDER BY COALESCE(s.surgery_date, s.scheduled_date) DESC NULLS LAST, s.created_at DESC
      LIMIT 25`, [`%${term.slice(0, 80)}%`]
  );
  return rows.map(camel);
}

async function getCaseUsage(surgeryId) {
  const surgery = await queryOne(
    `SELECT s.surgery_id, s.surgery_number, s.status, s.surgery_date, s.scheduled_date,
            p.mr_number, p.full_name AS patient_name, st.name AS surgery_name
       FROM surgeries s JOIN patients p ON p.patient_id=s.patient_id
       LEFT JOIN surgery_types st ON st.surgery_type_id=s.surgery_type_id
      WHERE s.surgery_id=$1`, [surgeryId]
  );
  if (!surgery) throw ApiError.notFound('Surgery case not found.');

  const usage = await queryRows(
    `SELECT u.usage_id, u.item_id, ci.item_code, ci.item_name, u.location_id,
            l.location_code, u.quantity_issued, u.uom, u.unit_cost, u.batch_number,
            u.expiry_date, u.serial_number, u.notes, u.issued_at,
            COALESCE(SUM(CASE WHEN ev.event_type='RETURN' THEN ev.quantity ELSE 0 END),0)::numeric(14,3) AS quantity_returned,
            COALESCE(SUM(CASE WHEN ev.event_type='WASTAGE' THEN ev.quantity ELSE 0 END),0)::numeric(14,3) AS quantity_wasted,
            COALESCE(SUM(CASE WHEN ev.event_type='RETURN' THEN ev.quantity ELSE 0 END),0)::numeric(14,3) AS return_total,
            (SELECT h.handover_id FROM pharmacy_billing_handover h WHERE h.usage_id=u.usage_id) AS handover_id
       FROM surgery_usage_lines u
       JOIN consumable_items ci ON ci.item_id=u.item_id
       JOIN stock_locations l ON l.location_id=u.location_id
       LEFT JOIN surgery_usage_events ev ON ev.usage_id=u.usage_id
      WHERE u.surgery_id=$1
      GROUP BY u.usage_id, ci.item_code, ci.item_name, l.location_code
      ORDER BY u.issued_at DESC`, [surgeryId]
  );
  const balances = await queryRows(
    `SELECT b.item_id, b.item_code, b.item_name, b.location_id, l.location_code,
            b.batch_number, b.expiry_date, b.serial_number, b.uom, b.on_hand_qty,
            b.last_receipt_cost
       FROM v_stock_balance b
       JOIN stock_locations l ON l.location_id=b.location_id
      WHERE b.on_hand_qty > 0 AND l.is_active=TRUE
      ORDER BY b.item_name, b.expiry_date NULLS LAST, b.batch_number NULLS LAST`, []
  );
  const caseCost = usage.reduce((sum, row) => sum + (Number(row.quantity_issued) - Number(row.quantity_returned)) * Number(row.unit_cost), 0);
  return {
    surgery: camel(surgery),
    usageLines: usage.map(camel),
    availableStock: balances.map(camel),
    actualConsumablesCost: Number(caseCost.toFixed(2)),
  };
}

async function issueStock(data, userId) {
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`case-usage:${data.idempotencyKey}`]);
    const replay = await client.query(
      `SELECT u.usage_id FROM surgery_usage_lines u JOIN stock_ledger sl ON sl.ledger_id=u.issue_ledger_id
        WHERE sl.idempotency_key=$1`, [data.idempotencyKey]
    );
    if (replay.rows[0]) return { idempotentReplay: true, usageId: replay.rows[0].usage_id };

    const caseResult = await client.query('SELECT surgery_id, status FROM surgeries WHERE surgery_id=$1 FOR UPDATE', [data.surgeryId]);
    if (!caseResult.rows[0]) throw ApiError.notFound('Surgery case not found.');
    if (CLOSED_STATUSES.has(caseResult.rows[0].status)) throw ApiError.conflict('Cancelled, deleted or closed surgeries cannot receive stock usage.');

    const location = await client.query('SELECT location_id FROM stock_locations WHERE location_id=$1 AND is_active=TRUE', [data.locationId]);
    if (!location.rows[0]) throw ApiError.badRequest('Selected OT Store location is not active.');

    const itemResult = await client.query(
      `SELECT item_id,item_code,item_name,is_active,
              COALESCE(NULLIF(uom,''),NULLIF(unit,'')) AS base_uom,
              track_batch,track_expiry,track_serial
         FROM consumable_items WHERE item_id=$1`, [data.itemId]
    );
    const item = itemResult.rows[0];
    if (!item || !item.is_active) throw ApiError.badRequest('Selected item does not exist or is inactive.');
    if (!item.base_uom) throw ApiError.badRequest('Item Base UOM is missing. Update Item Master first.');
    if (item.track_batch && !data.batchNumber) throw ApiError.badRequest(`Batch number is required for ${item.item_name}.`);
    if (item.track_serial && (!data.serialNumber || Number(data.quantity) !== 1)) throw ApiError.badRequest(`Serial-tracked item ${item.item_name} must be issued one serial-numbered unit per line.`);

    // Serialize stock movement for this exact item/location/batch/serial to prevent over-issue races.
    const lockKey = `stock:${data.itemId}:${data.locationId}:${data.batchNumber || '*'}:${data.serialNumber || '*'}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
    const balance = await client.query(
      `SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric(14,3) AS available,
              (ARRAY_AGG(unit_cost ORDER BY entered_at DESC) FILTER (WHERE unit_cost IS NOT NULL AND txn_type IN ('RECEIPT','OPENING')))[1] AS unit_cost,
              MAX(expiry_date) AS expiry_date
         FROM stock_ledger
        WHERE item_id=$1 AND location_id=$2
          AND batch_number IS NOT DISTINCT FROM $3
          AND serial_number IS NOT DISTINCT FROM $4`,
      [data.itemId, data.locationId, data.batchNumber || null, data.serialNumber || null]
    );
    const available = Number(balance.rows[0].available || 0);
    if (available < Number(data.quantity)) throw ApiError.conflict(`Insufficient stock for ${item.item_name}. Available: ${available} ${item.base_uom}.`);
    const expiryDate = balance.rows[0].expiry_date || null;
    if (data.expiryDate && expiryDate && String(data.expiryDate).slice(0,10) !== String(expiryDate).slice(0,10)) throw ApiError.badRequest('Expiry date must match the selected stock batch.');
    if (item.track_expiry && !expiryDate) throw ApiError.badRequest(`Expiry date is required for ${item.item_name}.`);
    if (expiryDate && new Date(`${expiryDate}T00:00:00Z`) < new Date(new Date().toISOString().slice(0,10) + 'T00:00:00Z')) {
      throw ApiError.conflict(`Expired batch cannot be issued for ${item.item_name}.`);
    }
    const unitCost = Number(balance.rows[0].unit_cost || 0);
    const usageId = randomUUID();
    const ledgerId = randomUUID();
    await client.query(
      `INSERT INTO surgery_usage_lines
        (usage_id,surgery_id,item_id,location_id,issue_ledger_id,quantity_issued,uom,unit_cost,batch_number,expiry_date,serial_number,notes,issued_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [usageId,data.surgeryId,data.itemId,data.locationId,ledgerId,data.quantity,item.base_uom,unitCost,
       data.batchNumber || null,expiryDate,data.serialNumber || null,data.notes || null,userId]
    );
    await client.query(
      `INSERT INTO stock_ledger
        (ledger_id,item_id,location_id,txn_type,qty_in,qty_out,uom,batch_number,expiry_date,serial_number,unit_cost,surgery_id,usage_id,reference_number,reason,idempotency_key,entered_by)
       VALUES ($1,$2,$3,'ISSUE_CASE',0,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [ledgerId,data.itemId,data.locationId,data.quantity,item.base_uom,data.batchNumber || null,expiryDate,
       data.serialNumber || null,unitCost,data.surgeryId,usageId,data.surgeryNumber || null,data.notes || 'Surgery case consumption',data.idempotencyKey,userId]
    );
    return { usageId, ledgerId, itemName: item.item_name, quantityIssued: Number(data.quantity), uom: item.base_uom, unitCost, totalCost: Number((Number(data.quantity)*unitCost).toFixed(2)), idempotentReplay: false };
  });
}

async function addAdjustment({ usageId, quantity, idempotencyKey, notes }, userId, txnType) {
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`case-usage-adjust:${idempotencyKey}`]);
    const replay = await client.query(
      `SELECT sl.ledger_id, ev.event_id FROM surgery_usage_events ev LEFT JOIN stock_ledger sl ON sl.ledger_id=ev.ledger_id WHERE ev.idempotency_key=$1`, [idempotencyKey]
    );
    if (replay.rows[0]) return { ledgerId: replay.rows[0].ledger_id || null, eventId: replay.rows[0].event_id, idempotentReplay: true };
    const usageResult = await client.query(
      `SELECT u.*, s.status FROM surgery_usage_lines u JOIN surgeries s ON s.surgery_id=u.surgery_id
        WHERE u.usage_id=$1 FOR UPDATE OF u,s`, [usageId]
    );
    const usage = usageResult.rows[0];
    if (!usage) throw ApiError.notFound('Surgery usage line not found.');
    if (CLOSED_STATUSES.has(usage.status)) throw ApiError.conflict('Cancelled, deleted or closed surgeries cannot be adjusted.');
    const handedOver = await client.query('SELECT 1 FROM pharmacy_billing_handover WHERE usage_id=$1', [usageId]);
    if (handedOver.rows[0]) throw ApiError.conflict('This usage line was already handed over to pharmacy. Coordinate any correction with pharmacy before changing it.');
    const totals = await client.query(
      `SELECT COALESCE(SUM(quantity) FILTER (WHERE event_type='RETURN'),0)::numeric AS returned,
              COALESCE(SUM(quantity) FILTER (WHERE event_type='WASTAGE'),0)::numeric AS wasted
         FROM surgery_usage_events WHERE usage_id=$1`, [usageId]
    );
    const returned = Number(totals.rows[0].returned || 0);
    const wasted = Number(totals.rows[0].wasted || 0);
    const remaining = Number(usage.quantity_issued) - returned - wasted;
    if (Number(quantity) > remaining) throw ApiError.conflict(`Quantity exceeds remaining issued balance (${remaining}).`);
    const isReturn = txnType === 'RETURN_CASE';
    const ledgerId = isReturn ? randomUUID() : null;
    if (isReturn) {
      await client.query(
        `INSERT INTO stock_ledger
          (ledger_id,item_id,location_id,txn_type,qty_in,qty_out,uom,batch_number,expiry_date,serial_number,unit_cost,surgery_id,usage_id,reason,idempotency_key,entered_by)
         VALUES ($1,$2,$3,'RETURN_CASE',$4,0,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [ledgerId,usage.item_id,usage.location_id,quantity,usage.uom,usage.batch_number,usage.expiry_date,
         usage.serial_number,usage.unit_cost,usage.surgery_id,usageId,notes||'Unused stock returned',idempotencyKey,userId]
      );
    }
    await client.query(
      `INSERT INTO surgery_usage_events(idempotency_key,usage_id,event_type,quantity,ledger_id,notes,recorded_by)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [idempotencyKey,usageId,isReturn?'RETURN':'WASTAGE',quantity,ledgerId,notes||null,userId]
    );
    return { ledgerId, usageId, movementType: txnType, quantity: Number(quantity), uom: usage.uom, idempotentReplay: false };
  });
}

async function handoverToPharmacy(usageId, notes, userId) {
  return withTransaction(async (client) => {
    const usageResult = await client.query(
      `SELECT u.*, s.status FROM surgery_usage_lines u JOIN surgeries s ON s.surgery_id=u.surgery_id WHERE u.usage_id=$1 FOR UPDATE OF u,s`, [usageId]
    );
    const usage = usageResult.rows[0];
    if (!usage) throw ApiError.notFound('Surgery usage line not found.');
    const existing = await client.query('SELECT * FROM pharmacy_billing_handover WHERE usage_id=$1', [usageId]);
    if (existing.rows[0]) return { ...camel(existing.rows[0]), idempotentReplay: true };
    if (['CANCELLED','DELETED'].includes(usage.status)) throw ApiError.conflict('Cannot hand over usage for a cancelled or deleted surgery.');
    const totals = await client.query(
      `SELECT COALESCE(SUM(quantity) FILTER (WHERE event_type='RETURN'),0)::numeric AS returned,
              COALESCE(SUM(quantity) FILTER (WHERE event_type='WASTAGE'),0)::numeric AS wasted FROM surgery_usage_events WHERE usage_id=$1`, [usageId]
    );
    const billableQuantity = Math.max(0, Number(usage.quantity_issued)-Number(totals.rows[0].returned||0)-Number(totals.rows[0].wasted||0));
    const result = await client.query(
      `INSERT INTO pharmacy_billing_handover(usage_id,surgery_id,item_id,billable_quantity,uom,unit_cost,handed_over_by,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [usageId,usage.surgery_id,usage.item_id,billableQuantity,usage.uom,usage.unit_cost,userId,notes||null]
    );
    return { ...camel(result.rows[0]), idempotentReplay: false };
  });
}

module.exports = { findCase, getCaseUsage, issueStock, returnStock: (d,u)=>addAdjustment(d,u,'RETURN_CASE'), recordWastage: (d,u)=>addAdjustment(d,u,'WASTAGE'), handoverToPharmacy };
