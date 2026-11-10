'use strict';

const { queryRows, queryOne, withTransaction } = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const { validateReceiptLines } = require('./stockReceiving.rules');

const camel = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [
  key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()), value,
]));

async function listItems(search = '', locationId = null) {
  const params = [locationId || null];
  let where = "WHERE ci.is_active = TRUE AND COALESCE(NULLIF(ci.uom, ''), NULLIF(ci.unit, '')) IS NOT NULL";
  if (search) {
    params.push(`%${String(search).trim().slice(0, 100)}%`);
    const searchParam = `$${params.length}`;
    where += ` AND (ci.item_code ILIKE ${searchParam} OR ci.item_name ILIKE ${searchParam} OR ci.generic_name ILIKE ${searchParam} OR ci.brand ILIKE ${searchParam})`;
  }
  const rows = await queryRows(
    `SELECT ci.item_id, ci.item_code, ci.item_name, ci.category,
            COALESCE(NULLIF(ci.uom, ''), NULLIF(ci.unit, '')) AS uom,
            ci.pack_size, ci.pack_uom, ci.track_batch, ci.track_expiry, ci.track_serial,
            ci.purchase_rate, ci.standard_cost, ci.default_vendor_id,
            COALESCE(t.fixed_qty, ci.fixed_qty_in_ot, 0) AS fixed_qty_in_ot
       FROM consumable_items ci
       LEFT JOIN ot_fixed_stock_targets t ON t.item_id=ci.item_id
         AND t.is_active=TRUE AND t.location_id=COALESCE($1::uuid, (SELECT location_id FROM stock_locations WHERE lower(trim(location_code))='ot_store' LIMIT 1))
       ${where}
      ORDER BY ci.item_name ASC LIMIT 300`, params
  );
  return rows.map(camel);
}

async function listLocations() {
  const rows = await queryRows(
    `SELECT location_id, location_code, location_name
       FROM stock_locations WHERE is_active = TRUE ORDER BY location_name`
  );
  return rows.map(camel);
}

async function getExistingReceipt(client, receiptId) {
  const header = await client.query(
    `SELECT r.*, v.name AS vendor_name, l.location_code, l.location_name,
            u.full_name AS received_by_name, a.file_name AS invoice_file_name
       FROM stock_receipts r
       LEFT JOIN stock_receipt_attachments a ON a.receipt_id=r.receipt_id
       LEFT JOIN vendors v ON v.vendor_id = r.vendor_id
       JOIN stock_locations l ON l.location_id = r.location_id
       LEFT JOIN users u ON u.user_id = r.received_by
      WHERE r.receipt_id = $1`, [receiptId]
  );
  if (!header.rows[0]) return null;
  const lines = await client.query(
    `SELECT sl.ledger_id, sl.item_id, ci.item_code, ci.item_name,
            sl.qty_in AS quantity, sl.uom, sl.batch_number, sl.expiry_date,
            sl.serial_number, sl.unit_cost
       FROM stock_ledger sl JOIN consumable_items ci ON ci.item_id = sl.item_id
      WHERE sl.receipt_id = $1 AND sl.txn_type = 'RECEIPT'
      ORDER BY ci.item_name, sl.batch_number NULLS FIRST`, [receiptId]
  );
  return { ...camel(header.rows[0]), lines: lines.rows.map(camel), idempotentReplay: true };
}

async function createReceipt(data, userId) {
  validateReceiptLines(data.lines);

  return withTransaction(async (client) => {
    // Serialize concurrent retries using the same receipt UUID before checking
    // for an existing header. This closes the duplicate-submit race.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [data.receiptId]);
    // The caller-generated receipt UUID is the idempotency key. A retry returns
    // the original immutable receipt instead of creating duplicate stock.
    const existing = await getExistingReceipt(client, data.receiptId);
    if (existing) return existing;

    const locationResult = await client.query(
      `SELECT location_id FROM stock_locations WHERE location_id = $1 AND is_active = TRUE`,
      [data.locationId]
    );
    if (!locationResult.rows[0]) throw ApiError.badRequest('Selected stock location does not exist or is inactive.');

    if (data.vendorId) {
      const vendorResult = await client.query(
        `SELECT vendor_id FROM vendors WHERE vendor_id = $1 AND is_active = TRUE`, [data.vendorId]
      );
      if (!vendorResult.rows[0]) throw ApiError.badRequest('Selected supplier does not exist or is inactive.');
    }

    const itemIds = [...new Set(data.lines.map((line) => line.itemId))];
    const itemResult = await client.query(
      `SELECT item_id, item_code, item_name, is_active,
              COALESCE(NULLIF(uom, ''), NULLIF(unit, '')) AS base_uom,
              track_batch, track_expiry, track_serial
         FROM consumable_items WHERE item_id = ANY($1::uuid[])`, [itemIds]
    );
    const itemMap = new Map(itemResult.rows.map((item) => [item.item_id, item]));
    if (itemMap.size !== itemIds.length) throw ApiError.badRequest('One or more selected items do not exist.');

    for (const [index, line] of data.lines.entries()) {
      const item = itemMap.get(line.itemId);
      if (!item.is_active) throw ApiError.badRequest(`Item ${item.item_name} is inactive.`);
      if (!item.base_uom) throw ApiError.badRequest(`Base unit is missing for item ${item.item_name}. Update Item Master before receiving stock.`);
      if (item.track_batch && !line.batchNumber) throw ApiError.badRequest(`Batch number is required for ${item.item_name} (line ${index + 1}).`);
      if (item.track_expiry && !line.expiryDate) throw ApiError.badRequest(`Expiry date is required for ${item.item_name} (line ${index + 1}).`);
      if (item.track_serial && !line.serialNumber) throw ApiError.badRequest(`Serial number is required for ${item.item_name} (line ${index + 1}).`);
      if (item.track_serial && Number(line.quantity) !== 1) throw ApiError.badRequest(`Serial-tracked item ${item.item_name} must be received one unit per line.`);
    }

    const receiptResult = await client.query(
      `INSERT INTO stock_receipts
        (receipt_id, location_id, vendor_id, receipt_number, invoice_number,
         invoice_date, received_by, device_id, reference_number, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING receipt_id, location_id, vendor_id, receipt_number, invoice_number,
                 invoice_date, received_at, received_by, device_id, reference_number, notes`,
      [data.receiptId, data.locationId, data.vendorId || null, data.receiptNumber || null,
       data.invoiceNumber || null, data.invoiceDate || null, userId, data.deviceId || null,
       data.referenceNumber || null, data.notes || null]
    );

    const savedLines = [];
    for (const line of data.lines) {
      const item = itemMap.get(line.itemId);
      const result = await client.query(
        `INSERT INTO stock_ledger
          (item_id, location_id, txn_type, qty_in, qty_out, uom, batch_number,
           expiry_date, serial_number, unit_cost, vendor_id, receipt_id,
           reference_number, idempotency_key, entered_by, device_id)
         VALUES ($1,$2,'RECEIPT',$3,0,$4,$5,$6,$7,$8,$9,$10,$11,gen_random_uuid(),$12,$13)
         RETURNING ledger_id, item_id, qty_in AS quantity, uom, batch_number,
                   expiry_date, serial_number, unit_cost`,
        [line.itemId, data.locationId, line.quantity, item.base_uom, line.batchNumber || null,
         line.expiryDate || null, line.serialNumber || null, line.unitCost, data.vendorId || null,
         data.receiptId, data.referenceNumber || data.invoiceNumber || null, userId, data.deviceId || null]
      );
      savedLines.push({ ...camel(result.rows[0]), itemCode: item.item_code, itemName: item.item_name });
    }

    const header = receiptResult.rows[0];
    return {
      ...camel(header),
      vendorName: data.vendorId ? (await client.query('SELECT name FROM vendors WHERE vendor_id=$1', [data.vendorId])).rows[0]?.name || null : null,
      locationCode: (await client.query('SELECT location_code FROM stock_locations WHERE location_id=$1', [data.locationId])).rows[0]?.location_code,
      lines: savedLines,
      idempotentReplay: false,
    };
  });
}

async function listReceipts({ page = 1, limit = 20, search = '', dateFrom, dateTo } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const values = [];
  const where = [];
  if (search) {
    values.push(`%${String(search).trim().slice(0, 100)}%`);
    where.push(`(COALESCE(r.invoice_number,'') ILIKE $${values.length} OR COALESCE(r.receipt_number,'') ILIKE $${values.length} OR COALESCE(v.name,'') ILIKE $${values.length})`);
  }
  if (dateFrom) { values.push(dateFrom); where.push(`r.received_at >= $${values.length}::date`); }
  if (dateTo) { values.push(dateTo); where.push(`r.received_at < ($${values.length}::date + INTERVAL '1 day')`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await queryOne(
    `SELECT COUNT(*)::int AS total FROM stock_receipts r LEFT JOIN vendors v ON v.vendor_id=r.vendor_id ${clause}`,
    values
  );
  const rows = await queryRows(
    `SELECT r.receipt_id, r.receipt_number, r.invoice_number, r.invoice_date,
            r.received_at, r.notes, v.name AS vendor_name, l.location_code,
            u.full_name AS received_by_name,
            COUNT(sl.ledger_id)::int AS line_count,
            COALESCE(SUM(sl.qty_in * sl.unit_cost),0)::numeric(14,2) AS receipt_total,
            a.file_name AS invoice_file_name
       FROM stock_receipts r
       LEFT JOIN stock_receipt_attachments a ON a.receipt_id=r.receipt_id
       LEFT JOIN vendors v ON v.vendor_id=r.vendor_id
       JOIN stock_locations l ON l.location_id=r.location_id
       LEFT JOIN users u ON u.user_id=r.received_by
       LEFT JOIN stock_ledger sl ON sl.receipt_id=r.receipt_id AND sl.txn_type='RECEIPT'
       ${clause}
      GROUP BY r.receipt_id, v.name, l.location_code, u.full_name, a.file_name
      ORDER BY r.received_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, safeLimit, (safePage - 1) * safeLimit]
  );
  return { items: rows.map(camel), meta: { page: safePage, limit: safeLimit, total: Number(count.total), totalPages: Math.ceil(Number(count.total) / safeLimit) } };
}

async function getReceipt(receiptId) {
  const header = await queryOne(
    `SELECT r.*, v.name AS vendor_name, l.location_code, l.location_name,
            u.full_name AS received_by_name, a.file_name AS invoice_file_name
       FROM stock_receipts r LEFT JOIN stock_receipt_attachments a ON a.receipt_id=r.receipt_id
       LEFT JOIN vendors v ON v.vendor_id=r.vendor_id
       JOIN stock_locations l ON l.location_id=r.location_id
       LEFT JOIN users u ON u.user_id=r.received_by
      WHERE r.receipt_id=$1`, [receiptId]
  );
  if (!header) throw ApiError.notFound('Stock receipt not found.');
  const lines = await queryRows(
    `SELECT sl.ledger_id, sl.item_id, ci.item_code, ci.item_name,
            sl.qty_in AS quantity, sl.uom, sl.batch_number, sl.expiry_date,
            sl.serial_number, sl.unit_cost
       FROM stock_ledger sl JOIN consumable_items ci ON ci.item_id=sl.item_id
      WHERE sl.receipt_id=$1 AND sl.txn_type='RECEIPT'
      ORDER BY ci.item_name, sl.batch_number NULLS FIRST`, [receiptId]
  );
  return { ...camel(header), lines: lines.map(camel) };
}

async function getBalances({ search = '', locationId, itemId, page = 1, limit = 50 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const values = [];
  const where = ['b.on_hand_qty <> 0'];
  if (search) {
    values.push(`%${String(search).trim().slice(0, 100)}%`);
    where.push(`(b.item_code ILIKE $${values.length} OR b.item_name ILIKE $${values.length})`);
  }
  if (locationId) { values.push(locationId); where.push(`b.location_id=$${values.length}`); }
  if (itemId) { values.push(itemId); where.push(`b.item_id=$${values.length}`); }
  const clause = `WHERE ${where.join(' AND ')}`;
  const count = await queryOne(`SELECT COUNT(*)::int AS total FROM v_stock_balance b ${clause}`, values);
  const rows = await queryRows(
    `SELECT b.* FROM v_stock_balance b ${clause}
      ORDER BY b.item_name, b.expiry_date NULLS LAST, b.batch_number NULLS LAST
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, safeLimit, (safePage - 1) * safeLimit]
  );
  return { items: rows.map(camel), meta: { page: safePage, limit: safeLimit, total: Number(count.total), totalPages: Math.ceil(Number(count.total) / safeLimit) } };
}



async function getBalanceSummary(locationId) {
  const rows = await queryRows(
    `SELECT item_id, location_id, SUM(on_hand_qty)::NUMERIC(14,3) AS on_hand_qty
       FROM v_stock_balance
      WHERE location_id=$1
      GROUP BY item_id, location_id`, [locationId]
  );
  return rows.map(camel);
}

async function recordPhysicalCount(data, userId) {
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`physical-count:${data.idempotencyKey}`]);
    const replay = await client.query(
      `SELECT ledger_id, item_id, location_id, txn_type, qty_in, qty_out, uom,
              batch_number, expiry_date, serial_number, reason, approved_by, approved_at
         FROM stock_ledger WHERE idempotency_key = $1`, [data.idempotencyKey]
    );
    if (replay.rows[0]) return { ...camel(replay.rows[0]), idempotentReplay: true };

    const itemResult = await client.query(
      `SELECT item_id, item_name, is_active,
              COALESCE(NULLIF(uom,''), NULLIF(unit,'')) AS base_uom,
              track_batch, track_expiry, track_serial,
              (SELECT sl.unit_cost FROM stock_ledger sl
                WHERE sl.item_id=ci.item_id AND sl.txn_type IN ('RECEIPT','OPENING') AND sl.unit_cost IS NOT NULL
                ORDER BY sl.entered_at DESC LIMIT 1) AS last_cost
         FROM consumable_items ci WHERE item_id=$1`, [data.itemId]
    );
    const item = itemResult.rows[0];
    if (!item || !item.is_active) throw ApiError.badRequest('Selected item does not exist or is inactive.');
    if (!item.base_uom) throw ApiError.badRequest('Base UOM is missing in Item Master.');
    if (item.track_batch && !data.batchNumber) throw ApiError.badRequest('Batch number is required for this item.');
    if (item.track_expiry && !data.expiryDate) throw ApiError.badRequest('Expiry date is required for this item.');
    if (item.track_serial && !data.serialNumber) throw ApiError.badRequest('Serial number is required for this item.');
    if (item.track_serial && ![0, 1].includes(Number(data.countedQuantity))) throw ApiError.badRequest('Serial-tracked items must be counted as 0 or 1 per serial number.');

    const location = await client.query('SELECT location_id FROM stock_locations WHERE location_id=$1 AND is_active=TRUE', [data.locationId]);
    if (!location.rows[0]) throw ApiError.badRequest('Selected stock location does not exist or is inactive.');

    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`physical-count-stock:${data.itemId}:${data.locationId}:${data.batchNumber || ''}:${data.expiryDate || ''}:${data.serialNumber || ''}`]);
    const currentResult = await client.query(
      `SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric(14,3) AS current_qty
         FROM stock_ledger
        WHERE item_id=$1 AND location_id=$2
          AND batch_number IS NOT DISTINCT FROM $3
          AND expiry_date IS NOT DISTINCT FROM $4::date
          AND serial_number IS NOT DISTINCT FROM $5`,
      [data.itemId, data.locationId, data.batchNumber || null, data.expiryDate || null, data.serialNumber || null]
    );
    const currentQty = Number(currentResult.rows[0].current_qty);
    const countedQty = Number(data.countedQuantity);
    const difference = Number((countedQty - currentQty).toFixed(3));
    if (difference === 0) return { noChange: true, itemName: item.item_name, currentQuantity: currentQty, countedQuantity: countedQty, difference: 0 };

    const result = await client.query(
      `INSERT INTO stock_ledger
        (item_id, location_id, txn_type, qty_in, qty_out, uom, batch_number, expiry_date,
         serial_number, unit_cost, reason, approved_by, approved_at, approval_reason,
         idempotency_key, entered_by)
       VALUES ($1,$2,'ADJUSTMENT',$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$10,$12,$11)
       RETURNING ledger_id, item_id, location_id, txn_type, qty_in, qty_out, uom,
                 batch_number, expiry_date, serial_number, reason, approved_by, approved_at`,
      [data.itemId, data.locationId, difference > 0 ? difference : 0, difference < 0 ? Math.abs(difference) : 0,
       item.base_uom, data.batchNumber || null, data.expiryDate || null, data.serialNumber || null,
       item.last_cost, data.reason, userId, data.idempotencyKey]
    );
    return { ...camel(result.rows[0]), itemName: item.item_name, previousQuantity: currentQty,
      countedQuantity: countedQty, difference, idempotentReplay: false };
  });
}

async function saveReceiptInvoice(receiptId, file, userId) {
  const receipt = await queryOne('SELECT receipt_id FROM stock_receipts WHERE receipt_id=$1', [receiptId]);
  if (!receipt) throw ApiError.notFound('Stock receipt not found.');
  const existing = await queryOne('SELECT attachment_id, file_name, file_path, file_size, mime_type, uploaded_at FROM stock_receipt_attachments WHERE receipt_id=$1', [receiptId]);
  if (existing) return { ...camel(existing), alreadyUploaded: true };
  const row = await queryOne(
    `INSERT INTO stock_receipt_attachments(receipt_id,file_name,file_path,file_size,mime_type,uploaded_by)
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING attachment_id,receipt_id,file_name,file_path,file_size,mime_type,uploaded_at`,
    [receiptId, file.fileName, file.filePath, file.fileSize, file.mimeType, userId || null]
  );
  return camel(row);
}

async function getReceiptInvoice(receiptId) {
  const row = await queryOne(
    `SELECT attachment_id, receipt_id, file_name, file_path, file_size, mime_type, uploaded_at
       FROM stock_receipt_attachments WHERE receipt_id=$1`, [receiptId]
  );
  if (!row) throw ApiError.notFound('No invoice attachment was found for this receipt.');
  return camel(row);
}

module.exports = { listItems, listLocations, createReceipt, listReceipts, getReceipt, getBalances, recordPhysicalCount, saveReceiptInvoice, getReceiptInvoice, getBalanceSummary };
