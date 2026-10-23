'use strict';

const { query, queryOne, queryRows, withTransaction } = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(s) {
  return s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
}

function toRow(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[snakeToCamel(k)] = v;
  return out;
}

// Generated/computed columns that must never be in INSERT/UPDATE
const GENERATED_COLS = new Set([
  'budget_total', 'actual_total', 'profit_amount', 'duration_minutes', 'total_cost',
]);

// Statuses where budget fields become readonly (locked after Budget Approved)
const BUDGET_LOCKED_STATUSES = new Set([
  'BUDGET_APPROVED', 'SCHEDULED', 'RESCHEDULED', 'POSTPONED',
  'SURGERY_COMPLETED', 'PARTIALLY_RECONCILED', 'FULLY_RECONCILED', 'CLOSED',
]);

// Status transition rules — new workflow + backward-compat legacy transitions
const ALLOWED_TRANSITIONS = {
  // New workflow — DELETED allowed from pre-scheduled stages (admin cleanup)
  DRAFT:                      ['PLANNED', 'CANCELLED', 'DELETED'],
  PLANNED:                    ['SENT_FOR_BUDGET_APPROVAL', 'DRAFT', 'CANCELLED', 'DELETED'],
  SENT_FOR_BUDGET_APPROVAL:   ['BUDGET_APPROVED', 'REVISE_BUDGET', 'CANCELLED', 'DELETED'],
  REVISE_BUDGET:              ['SENT_FOR_BUDGET_APPROVAL', 'CANCELLED', 'DELETED'],
  BUDGET_APPROVED:            ['SCHEDULED', 'CANCELLED', 'DELETED'],
  SCHEDULED:                  ['RESCHEDULED', 'POSTPONED', 'SURGERY_COMPLETED', 'CANCELLED'],
  RESCHEDULED:                ['SCHEDULED', 'POSTPONED', 'SURGERY_COMPLETED', 'CANCELLED'],
  POSTPONED:                  ['SCHEDULED', 'CANCELLED'],
  SURGERY_COMPLETED:          ['PARTIALLY_RECONCILED', 'FULLY_RECONCILED', 'CLOSED'],
  PARTIALLY_RECONCILED:       ['FULLY_RECONCILED', 'CLOSED'],
  FULLY_RECONCILED:           ['CLOSED'],
  CLOSED:                     [],
  CANCELLED:                  ['DELETED'],  // allow cleanup of cancelled records
  // Legacy statuses — keep existing data moving
  PENDING:                    ['SCHEDULED', 'SENT_FOR_BUDGET_APPROVAL', 'DRAFT', 'CANCELLED', 'DELETED'],
  IN_PROGRESS:                ['COMPLETED', 'SURGERY_COMPLETED', 'CANCELLED'],
  COMPLETED:                  ['CLOSED'],
  DELETED:                    [],
};

// ─── fetchFullSurgery ─────────────────────────────────────────────────────────

async function fetchFullSurgery(client, surgeryId) {
  const qFn = client
    ? (t, p) => client.query(t, p)
    : (t, p) => query(t, p);

  const { rows: [s] } = await qFn(
    `SELECT s.*,
            p.mr_number,
            p.full_name        AS patient_full_name,
            p.date_of_birth,
            p.gender           AS patient_gender_from_patient,
            p.phone            AS patient_phone,
            p.blood_group      AS patient_blood_group,
            sg.full_name       AS surgeon_full_name,
            sg.employee_code   AS surgeon_employee_code,
            sg.specialization,
            an.full_name       AS anaesthetist_full_name,
            st.name            AS surgery_type_name,
            st.code            AS surgery_type_code,
            st.package_name,
            d.department_name,
            d.department_code,
            r.room_name,
            r.room_code,
            r.cost_per_minute,
            ss.planned_start_time    AS ot_planned_start_time,
            ss.expected_duration_min AS ot_expected_duration_min,
            ss.schedule_id           AS ot_schedule_id,
            ss.planned_date          AS ot_planned_date,
            ss.status                AS ot_schedule_status,
            ss.priority              AS schedule_priority,
            ss.ot_room_id            AS ot_sched_room_id,
            sr.room_name             AS ot_sched_room_name,
            sr.room_code             AS ot_sched_room_code,
            sr.cost_per_minute       AS ot_sched_cost_per_minute
     FROM   surgeries s
     JOIN   patients      p  ON p.patient_id       = s.patient_id
     JOIN   surgeons      sg ON sg.surgeon_id       = s.surgeon_id
     LEFT JOIN anaesthetists an ON an.anaesthetist_id = s.anaesthetist_id
     JOIN   surgery_types st ON st.surgery_type_id  = s.surgery_type_id
     LEFT JOIN departments d  ON d.department_id    = s.department_id
     LEFT JOIN ot_rooms   r  ON r.ot_room_id        = s.ot_room_id
     LEFT JOIN surgery_schedules ss ON ss.surgery_id = s.surgery_id
       AND ss.schedule_id = (
         SELECT schedule_id FROM surgery_schedules
         WHERE surgery_id = s.surgery_id
         ORDER BY created_at DESC LIMIT 1
       )
     LEFT JOIN ot_rooms sr ON sr.ot_room_id = ss.ot_room_id
     WHERE  s.surgery_id = $1`,
    [surgeryId]
  );
  if (!s) return null;

  const [{ rows: assistants }, { rows: consumables }, { rows: pharmacy }, { rows: collections }] =
    await Promise.all([
      qFn(`SELECT sa.*, a.full_name AS assistant_full_name, a.role_title
           FROM surgery_assistants sa
           JOIN assistants a ON a.assistant_id = sa.assistant_id
           WHERE sa.surgery_id = $1`, [surgeryId]),
      qFn(`SELECT sc.*, ci.item_name, ci.item_code, ci.unit
           FROM surgery_consumables sc
           JOIN consumable_items ci ON ci.item_id = sc.item_id
           WHERE sc.surgery_id = $1`, [surgeryId]),
      qFn(`SELECT sp.*, pi.item_name, pi.item_code, pi.unit
           FROM surgery_pharmacy sp
           JOIN pharmacy_items pi ON pi.pharmacy_item_id = sp.pharmacy_item_id
           WHERE sp.surgery_id = $1`, [surgeryId]),
      qFn(`SELECT * FROM surgery_collections
           WHERE surgery_id = $1 ORDER BY collected_at`, [surgeryId]),
    ]);

  const surgery = toRow(s);
  surgery.patient = {
    patientId:   s.patient_id,
    mrNumber:    s.mr_number,
    fullName:    s.patient_full_name,
    dateOfBirth: s.date_of_birth,
    gender:      s.patient_gender_from_patient,
  };
  surgery.surgeon = {
    surgeonId:      s.surgeon_id,
    fullName:       s.surgeon_full_name,
    employeeCode:   s.surgeon_employee_code,
    specialization: s.specialization,
  };
  surgery.anaesthetist = s.anaesthetist_id
    ? { anaesthetistId: s.anaesthetist_id, fullName: s.anaesthetist_full_name }
    : null;
  surgery.surgeryType = {
    surgeryTypeId: s.surgery_type_id,
    name:          s.surgery_type_name,
    code:          s.surgery_type_code,
    packageName:   s.package_name,
  };
  surgery.department = s.department_id
    ? { departmentId: s.department_id, departmentName: s.department_name, departmentCode: s.department_code }
    : null;
  surgery.otRoom = s.ot_room_id
    ? { otRoomId: s.ot_room_id, roomName: s.room_name, roomCode: s.room_code, costPerMinute: s.cost_per_minute }
    : null;
  surgery.assistants = assistants.map((a) => ({
    surgeryAssistantId: a.surgery_assistant_id,
    assistantId:        a.assistant_id,
    feeAmount:          Number(a.fee_amount),
    assistant:          { fullName: a.assistant_full_name, roleTitle: a.role_title },
  }));
  surgery.consumables = consumables.map((c) => ({
    surgeryConsumableId: c.surgery_consumable_id,
    itemId:    c.item_id,
    quantity:  Number(c.quantity),
    unitCost:  Number(c.unit_cost),
    totalCost: Number(c.total_cost),
    item:      { itemName: c.item_name, itemCode: c.item_code, unit: c.unit },
  }));
  surgery.pharmacy = pharmacy.map((p) => ({
    surgeryPharmacyId: p.surgery_pharmacy_id,
    pharmacyItemId:    p.pharmacy_item_id,
    quantity:          Number(p.quantity),
    unitCost:          Number(p.unit_cost),
    totalCost:         Number(p.total_cost),
    pharmacyItem:      { itemName: p.item_name, itemCode: p.item_code, unit: p.unit },
  }));
  surgery.collections = collections.map(toRow);

  // OT Schedule fields (readonly in Surgery Entry) — always from surgery_schedules, not surgeries table
  surgery.otScheduleId          = s.ot_schedule_id || null;
  surgery.otPlannedStartTime    = s.ot_planned_start_time || null;
  surgery.otExpectedDurationMin = s.ot_expected_duration_min || null;
  surgery.otPlannedDate         = s.ot_planned_date || null;
  surgery.otScheduleStatus      = s.ot_schedule_status || null;
  surgery.schedulePriority      = s.schedule_priority || null;
  const clinicalWarnings = [];
  if (Number(surgery.asaGrade || 0) >= 3 && surgery.plannedOtType === 'Minor') clinicalWarnings.push('ASA grade III or higher with a Minor OT plan requires clinical review.');
  if (surgery.asaEmergency && surgery.schedulePriority !== 'EMERGENCY') clinicalWarnings.push('ASA emergency is selected but the schedule priority is not EMERGENCY.');
  surgery.warnings = clinicalWarnings;

  // Compute OT Out Time from start time + duration
  if (s.ot_planned_start_time && s.ot_expected_duration_min) {
    const [h, m] = s.ot_planned_start_time.split(':').map(Number);
    const totalMin = h * 60 + m + parseInt(s.ot_expected_duration_min, 10);
    const oh = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
    const om = String(totalMin % 60).padStart(2, '0');
    surgery.otPlannedEndTime = `${oh}:${om}`;
  } else {
    surgery.otPlannedEndTime = null;
  }

  // OT Room from the schedule (overrides surgery-level ot_room_id)
  surgery.otScheduleRoom = s.ot_sched_room_id
    ? { otRoomId: s.ot_sched_room_id, roomName: s.ot_sched_room_name, roomCode: s.ot_sched_room_code, costPerMinute: s.ot_sched_cost_per_minute }
    : null;

  return surgery;
}

// ─── list ─────────────────────────────────────────────────────────────────────

async function list(queryParams) {
  const { page, limit, skip, take } = parsePagination(queryParams);

  const conditions = [];
  const params = [];

  // Status filter — default excludes DELETED
  if (queryParams.status) {
    params.push(queryParams.status);
    conditions.push(`s.status = $${params.length}`);
  } else {
    conditions.push(`s.status != 'DELETED'`);
  }

  if (queryParams.surgeonId)     { params.push(queryParams.surgeonId);     conditions.push(`s.surgeon_id = $${params.length}`); }
  if (queryParams.surgeryTypeId) { params.push(queryParams.surgeryTypeId); conditions.push(`s.surgery_type_id = $${params.length}`); }
  if (queryParams.departmentId)  { params.push(queryParams.departmentId);  conditions.push(`s.department_id = $${params.length}`); }
  if (queryParams.branchId)      { params.push(queryParams.branchId);      conditions.push(`s.branch_id = $${params.length}`); }
  if (queryParams.patientId)     { params.push(queryParams.patientId);     conditions.push(`s.patient_id = $${params.length}`); }
  if (queryParams.dateFrom)      { params.push(queryParams.dateFrom);      conditions.push(`s.surgery_date >= $${params.length}`); }
  if (queryParams.dateTo)        { params.push(queryParams.dateTo);        conditions.push(`s.surgery_date <= $${params.length}`); }
  if (queryParams.minProfit !== undefined) { params.push(queryParams.minProfit); conditions.push(`s.profit_amount >= $${params.length}`); }
  if (queryParams.maxProfit !== undefined) { params.push(queryParams.maxProfit); conditions.push(`s.profit_amount <= $${params.length}`); }
  if (queryParams.search) {
    params.push(`%${queryParams.search}%`);
    const n = params.length;
    conditions.push(`(p.full_name ILIKE $${n} OR p.mr_number ILIKE $${n} OR sg.full_name ILIKE $${n} OR s.surgery_number ILIKE $${n})`);
  }

  const where   = `WHERE ${conditions.join(' AND ')}`;
  const sortCol = { surgeryDate: 's.surgery_date', createdAt: 's.created_at', budgetTotal: 's.budget_total', actualTotal: 's.actual_total', quotedPrice: 's.quoted_price' }[queryParams.sort?.split(':')[0]] || 's.created_at';
  const sortDir = queryParams.sort?.endsWith(':asc') ? 'ASC' : 'DESC';

  const countRes = await query(
    `SELECT COUNT(*)
       FROM surgeries s
       JOIN patients p  ON p.patient_id  = s.patient_id
       JOIN surgeons sg ON sg.surgeon_id = s.surgeon_id
       ${where}`,
    params
  );
  const totalCount = parseInt(countRes.rows[0].count, 10);

  const limitIdx  = params.length + 1;
  const offsetIdx = params.length + 2;
  const rows = await queryRows(
    `SELECT s.*,
            p.mr_number, p.full_name AS patient_full_name, p.gender AS patient_gender_db,
            sg.full_name AS surgeon_full_name,
            st.name AS surgery_type_name, st.code AS surgery_type_code,
            an.full_name AS anaesthetist_full_name
       FROM surgeries s
       JOIN patients      p  ON p.patient_id       = s.patient_id
       JOIN surgeons      sg ON sg.surgeon_id       = s.surgeon_id
       JOIN surgery_types st ON st.surgery_type_id  = s.surgery_type_id
       LEFT JOIN anaesthetists an ON an.anaesthetist_id = s.anaesthetist_id
       ${where}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, take, skip]
  );

  const items = rows.map((row) => {
    const surg = toRow(row);
    surg.patient     = { patientId: row.patient_id, mrNumber: row.mr_number, fullName: row.patient_full_name, gender: row.patient_gender_db };
    surg.surgeon     = { surgeonId: row.surgeon_id, fullName: row.surgeon_full_name };
    surg.surgeryType = { surgeryTypeId: row.surgery_type_id, name: row.surgery_type_name, code: row.surgery_type_code };
    surg.anaesthetist = row.anaesthetist_id ? { anaesthetistId: row.anaesthetist_id, fullName: row.anaesthetist_full_name } : null;
    return surg;
  });

  return { items, meta: buildPaginationMeta({ page, limit, totalCount }) };
}

// ─── getById ─────────────────────────────────────────────────────────────────

async function getById(id) {
  const surgery = await fetchFullSurgery(null, id);
  if (!surgery) throw ApiError.notFound('Surgery not found');
  return surgery;
}

// ─── getByPatientId ───────────────────────────────────────────────────────────

async function getByPatientId(patientId) {
  const rows = await queryRows(
    `SELECT s.*,
            sg.full_name AS surgeon_full_name,
            st.name AS surgery_type_name, st.code AS surgery_type_code
       FROM surgeries s
       JOIN surgeons      sg ON sg.surgeon_id       = s.surgeon_id
       JOIN surgery_types st ON st.surgery_type_id  = s.surgery_type_id
      WHERE s.patient_id = $1 AND s.status != 'DELETED'
      ORDER BY s.created_at DESC`,
    [patientId]
  );
  return rows.map((row) => {
    const surg = toRow(row);
    surg.surgeon     = { surgeonId: row.surgeon_id, fullName: row.surgeon_full_name };
    surg.surgeryType = { surgeryTypeId: row.surgery_type_id, name: row.surgery_type_name, code: row.surgery_type_code };
    return surg;
  });
}

// ─── create ──────────────────────────────────────────────────────────────────

async function create(data, userId) {
  const { assistants: assistantsList, ...surgeryData } = data;

  const SKIP = new Set(['assistants', 'budgetTotal', 'actualTotal', 'profitAmount', 'durationMinutes']);
  const colMap = {
    branchId: 'branch_id', departmentId: 'department_id', patientId: 'patient_id',
    surgeonId: 'surgeon_id', anaesthetistId: 'anaesthetist_id', surgeryTypeId: 'surgery_type_id',
    otRoomId: 'ot_room_id', patientAgeYears: 'patient_age_years', patientGender: 'patient_gender',
    anaesthesiaType: 'anaesthesia_type', scheduledDate: 'scheduled_date', surgeryDate: 'surgery_date',
    otInTime: 'ot_in_time', otOutTime: 'ot_out_time',
    budgetSurgeonFee: 'budget_surgeon_fee', budgetAssistantCost: 'budget_assistant_cost',
    budgetAnaesthetistFee: 'budget_anaesthetist_fee', budgetOtCost: 'budget_ot_cost',
    budgetConsumables: 'budget_consumables', budgetPharmacy: 'budget_pharmacy',
    budgetMiscellaneous: 'budget_miscellaneous',
    actualSurgeonFee: 'actual_surgeon_fee', actualAssistantCost: 'actual_assistant_cost',
    actualAnaesthetistFee: 'actual_anaesthetist_fee', actualOtCost: 'actual_ot_cost',
    actualConsumables: 'actual_consumables', actualPharmacy: 'actual_pharmacy',
    actualMiscellaneous: 'actual_miscellaneous',
    quotedPrice: 'quoted_price', collectedAmount: 'collected_amount',
    isOutlier: 'is_outlier', outlierReason: 'outlier_reason',
    ipOp: 'ip_op', admissionNumber: 'admission_number',
    diagnosis: 'diagnosis', plannedProcedure: 'planned_procedure',
    sideSite: 'side_site', clinicalNotes: 'clinical_notes', technicianType: 'technician_type',
    planDate: 'plan_date', cancelReason: 'cancel_reason',
    asaGrade: 'asa_grade', asaEmergency: 'asa_emergency', comorbidities: 'comorbidities',
    pacDate: 'pac_date', pacByStaffId: 'pac_by_staff_id', fitnessRemark: 'fitness_remark',
    specialPrecautions: 'special_precautions', plannedOtType: 'planned_ot_type', payerType: 'payer_type',
    payerName: 'payer_name', payerReference: 'payer_reference', preauthAmount: 'preauth_amount', hisUhid: 'his_uhid',
  };

  const cols = ['status', 'created_by', 'updated_by'];
  const vals = ['DRAFT', userId || null, userId || null];

  for (const [camel, snake] of Object.entries(colMap)) {
    if (SKIP.has(camel)) continue;
    if (surgeryData[camel] !== undefined && surgeryData[camel] !== null) {
      cols.push(snake);
      vals.push(surgeryData[camel]);
    }
  }

  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO surgeries (${cols.join(', ')}) VALUES (${placeholders}) RETURNING surgery_id`,
      vals
    );
    const surgeryId = rows[0].surgery_id;

    if (Array.isArray(assistantsList)) {
      for (const a of assistantsList) {
        await client.query(
          'INSERT INTO surgery_assistants (surgery_id, assistant_id, fee_amount) VALUES ($1, $2, $3)',
          [surgeryId, a.assistantId, a.feeAmount ?? 0]
        );
      }
    }

    return fetchFullSurgery(client, surgeryId);
  });
}

// ─── update ──────────────────────────────────────────────────────────────────

async function update(id, data, userId) {
  const existing = await getById(id);

  // Completed / Closed / Cancelled statuses — full lock
  if (['COMPLETED', 'CLOSED', 'CANCELLED', 'DELETED'].includes(existing.status)) {
    throw ApiError.badRequest(`Surgery in ${existing.status} status cannot be edited.`);
  }

  const { overrideReasons = {}, ...fields } = data;

  // Budget fields are readonly after Budget Approved
  if (BUDGET_LOCKED_STATUSES.has(existing.status)) {
    const BUDGET_KEYS = [
      'budgetSurgeonFee', 'budgetAssistantCost', 'budgetAnaesthetistFee',
      'budgetOtCost', 'budgetConsumables', 'budgetPharmacy', 'budgetMiscellaneous',
    ];
    for (const key of BUDGET_KEYS) {
      if (fields[key] !== undefined) {
        delete fields[key]; // silently drop locked budget fields
      }
    }
  }

  // Check for budget recommendation overrides
  const latestRec = await queryOne(
    `SELECT * FROM budget_recommendations
      WHERE surgery_id = $1
      ORDER BY generated_at DESC
      LIMIT 1`,
    [id]
  );

  const COMPONENT_MAP = {
    budgetSurgeonFee:       { component: 'SURGEON_FEE',   recField: 'recommended_surgeon_fee' },
    budgetAssistantCost:    { component: 'ASSISTANT',      recField: 'recommended_assistant_cost' },
    budgetAnaesthetistFee:  { component: 'ANAESTHETIST',  recField: 'recommended_anaesthetist_fee' },
    budgetOtCost:           { component: 'OT',            recField: 'recommended_ot_cost' },
    budgetConsumables:      { component: 'CONSUMABLES',   recField: 'recommended_consumables' },
    budgetPharmacy:         { component: 'PHARMACY',      recField: 'recommended_pharmacy' },
    budgetMiscellaneous:    { component: 'MISCELLANEOUS', recField: 'recommended_miscellaneous' },
  };

  const overridesToLog = [];
  if (latestRec) {
    for (const [field, { component, recField }] of Object.entries(COMPONENT_MAP)) {
      if (fields[field] === undefined) continue;
      const recValue = latestRec[recField];
      if (recValue === null || recValue === undefined) continue;
      const newVal = Number(fields[field]);
      const recVal = Number(recValue);
      if (Math.abs(newVal - recVal) > 0.01) {
        const reason = overrideReasons[field];
        if (!reason) {
          throw ApiError.badRequest(
            `Field "${field}" deviates from recommendation (${recVal} → ${newVal}). ` +
            `Provide overrideReasons.${field} to explain.`,
            { field, recommendedValue: recVal, newValue: newVal }
          );
        }
        overridesToLog.push({
          recommendation_id: latestRec.recommendation_id,
          surgery_id: id,
          component,
          recommended_value: recVal,
          overridden_value: newVal,
          override_reason: reason,
          overridden_by: userId || null,
        });
      }
    }
  }

  const SKIP_FIELDS = new Set([
    'overrideReasons', 'budgetTotal', 'actualTotal', 'profitAmount',
    'durationMinutes', 'totalCost', 'surgeryId', 'createdAt',
  ]);

  const setCols = [];
  const setVals = [];
  for (const [camel, val] of Object.entries(fields)) {
    if (SKIP_FIELDS.has(camel)) continue;
    const snake = camelToSnake(camel);
    if (GENERATED_COLS.has(snake)) continue;
    setCols.push(snake);
    setVals.push(val);
  }

  if (setCols.length === 0 && overridesToLog.length === 0) {
    return existing;
  }

  setCols.push('updated_by');
  setVals.push(userId || null);

  return withTransaction(async (client) => {
    if (setCols.length > 0) {
      const setClause = setCols.map((col, i) => `${col} = $${i + 1}`).join(', ');
      await client.query(
        `UPDATE surgeries
            SET ${setClause}, updated_at = now()
          WHERE surgery_id = $${setCols.length + 1}`,
        [...setVals, id]
      );
    }

    for (const o of overridesToLog) {
      await client.query(
        `INSERT INTO recommendation_overrides
         (recommendation_id, surgery_id, component, recommended_value, overridden_value, override_reason, overridden_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [o.recommendation_id, o.surgery_id, o.component,
         o.recommended_value, o.overridden_value, o.override_reason, o.overridden_by]
      );
    }

    return fetchFullSurgery(client, id);
  });
}

// ─── _syncOtSchedule — auto-create/update/cancel OT schedule ─────────────────

async function _syncOtSchedule(surgeryId, newStatus, userId, client) {
  const qFn = client
    ? (t, p) => client.query(t, p)
    : (t, p) => query(t, p);

  // Load surgery for fields needed by schedule
  const { rows: [surg] } = await qFn(
    `SELECT surgery_id, surgery_number, scheduled_date, ot_room_id,
            surgeon_id, anaesthetist_id
       FROM surgeries WHERE surgery_id = $1`,
    [surgeryId]
  );
  if (!surg) return;

  // Find existing active schedule (not cancelled)
  const { rows: [existingSched] } = await qFn(
    `SELECT schedule_id FROM surgery_schedules
      WHERE surgery_id = $1 AND status NOT IN ('CANCELLED')
      ORDER BY created_at DESC LIMIT 1`,
    [surgeryId]
  );

  // CANCELLED or DELETED — cancel the linked OT schedule
  if (newStatus === 'CANCELLED' || newStatus === 'DELETED') {
    if (existingSched) {
      const cancelReason = newStatus === 'DELETED' ? 'Surgery deleted' : 'Surgery cancelled';
      await qFn(
        `INSERT INTO surgery_schedule_history
           (schedule_id, surgery_id, action, reason, snapshot, changed_by)
         VALUES ($1, $2, 'CANCELLED', $3, $4, $5)`,
        [existingSched.schedule_id, surgeryId, cancelReason,
         JSON.stringify({ schedule_id: existingSched.schedule_id }), userId || null]
      );
      await qFn(
        `UPDATE surgery_schedules SET status='CANCELLED', updated_by=$1, updated_at=now()
          WHERE schedule_id=$2`,
        [userId || null, existingSched.schedule_id]
      );
    }
    return;
  }

  // Helper: auto-create OT schedule from surgery data
  // ── Status → OT schedule status mapping ───────────────────────────────
  // Surgery SCHEDULED/RESCHEDULED → OT CONFIRMED (confirmed booking)
  // Surgery POSTPONED             → OT POSTPONED
  // Surgery SURGERY_COMPLETED     → OT COMPLETED
  // Surgery CANCELLED/DELETED     → OT CANCELLED  (handled above)

  async function _autoCreateSchedule() {
    const plannedDate = surg.scheduled_date || new Date().toISOString().slice(0, 10);
    let otRoomId = surg.ot_room_id || null;

    // If room is already assigned on the surgery, check for overlap before using it.
    // If a conflict exists, create the schedule without a room — user assigns it via Edit.
    if (otRoomId) {
      const { rows: existing } = await qFn(
        `SELECT planned_start_time, expected_duration_min FROM surgery_schedules
          WHERE ot_room_id = $1 AND planned_date = $2
            AND status NOT IN ('CANCELLED', 'POSTPONED')`,
        [otRoomId, plannedDate]
      );
      const newStart = 9 * 60; // 09:00
      const newEnd   = newStart + 60;
      for (const s of existing) {
        const [h, m] = (s.planned_start_time || '09:00').split(':').map(Number);
        const exEnd  = h * 60 + m + (s.expected_duration_min || 60);
        if (newStart < exEnd && newEnd > (h * 60 + m)) { otRoomId = null; break; }
      }
    }

    const { rows: [newSched] } = await qFn(
      `INSERT INTO surgery_schedules
         (surgery_id, surgery_number, planned_date, planned_start_time,
          expected_duration_min, ot_room_id, priority,
          primary_surgeon_id, anaesthetist_id, status, created_by, updated_by)
       VALUES ($1, $2, $3, '09:00', 60, $4, 'ROUTINE', $5, $6, 'CONFIRMED', $7, $7)
       RETURNING schedule_id`,
      [
        surg.surgery_id,
        surg.surgery_number,
        plannedDate,
        otRoomId,
        surg.surgeon_id || null,
        surg.anaesthetist_id || null,
        userId || null,
      ]
    );
    await qFn(
      `INSERT INTO surgery_schedule_history
         (schedule_id, surgery_id, action, snapshot, changed_by)
       VALUES ($1, $2, 'CREATED', $3, $4)`,
      [newSched.schedule_id, surgeryId,
       JSON.stringify({ schedule_id: newSched.schedule_id }), userId || null]
    );
    return newSched;
  }

  // Helper: snapshot pre-op checklist items for this surgery (idempotent)
  async function _autoCreateSurgeryChecklist(sid, procedureId, qFnLocal) {
    try {
      // Find active template for this procedure
      const { rows: [template] } = await qFnLocal(
        `SELECT t.template_id
         FROM   preop_checklist_templates t
         WHERE  t.procedure_id = $1 AND t.is_active = true
         ORDER  BY t.created_at DESC LIMIT 1`,
        [procedureId]
      );
      if (!template) return; // no template — skip silently

      // Fetch template items
      const { rows: items } = await qFnLocal(
        `SELECT item_id, checklist_item, sort_order
         FROM   preop_checklist_items
         WHERE  template_id = $1
         ORDER  BY sort_order`,
        [template.template_id]
      );
      if (!items.length) return;

      // Upsert each item (skip if already exists for this surgery)
      for (const item of items) {
        await qFnLocal(
          `INSERT INTO surgery_checklist
             (surgery_id, template_item_id, item_label, sort_order, status)
           VALUES ($1, $2, $3, $4, 'PENDING')
           ON CONFLICT (surgery_id, template_item_id) DO NOTHING`,
          [sid, item.item_id, item.checklist_item, item.sort_order]
        );
      }
    } catch (err) {
      // non-fatal — log but don't fail the status transition
      const logger = require('../../config/logger');
      logger.warn('Auto-create surgery checklist failed (non-fatal):', err.message);
    }
  }

  if (newStatus === 'SCHEDULED') {
    if (!existingSched) {
      await _autoCreateSchedule();
    } else {
      // Surgery re-confirmed — ensure OT schedule shows CONFIRMED
      await qFn(
        `UPDATE surgery_schedules
            SET status='CONFIRMED', updated_by=$1, updated_at=now()
          WHERE schedule_id=$2 AND status NOT IN ('CANCELLED','COMPLETED')`,
        [userId || null, existingSched.schedule_id]
      );
    }
    // NOTE: surgery_checklist is NOT created here.
    // It is created only after a valid OT schedule (with room + date + time + duration)
    // is saved via scheduling.service.js create() → autoCreateChecklist().
    return;
  }

  if (newStatus === 'RESCHEDULED') {
    if (existingSched) {
      await qFn(
        `INSERT INTO surgery_schedule_history
           (schedule_id, surgery_id, action, reason, snapshot, changed_by)
         VALUES ($1, $2, 'RESCHEDULED', 'Surgery status changed to RESCHEDULED', $3, $4)`,
        [existingSched.schedule_id, surgeryId,
         JSON.stringify({ schedule_id: existingSched.schedule_id }), userId || null]
      );
      // Rescheduled = still a confirmed booking, keep CONFIRMED
      await qFn(
        `UPDATE surgery_schedules SET status='CONFIRMED', updated_by=$1, updated_at=now()
          WHERE schedule_id=$2`,
        [userId || null, existingSched.schedule_id]
      );
    } else {
      await _autoCreateSchedule();
    }
    return;
  }

  if (newStatus === 'POSTPONED') {
    if (existingSched) {
      await qFn(
        `INSERT INTO surgery_schedule_history
           (schedule_id, surgery_id, action, reason, snapshot, changed_by)
         VALUES ($1, $2, 'POSTPONED', 'Surgery status changed to POSTPONED', $3, $4)`,
        [existingSched.schedule_id, surgeryId,
         JSON.stringify({ schedule_id: existingSched.schedule_id }), userId || null]
      );
      await qFn(
        `UPDATE surgery_schedules SET status='POSTPONED', updated_by=$1, updated_at=now()
          WHERE schedule_id=$2`,
        [userId || null, existingSched.schedule_id]
      );
    } else {
      await _autoCreateSchedule();
    }
    return;
  }

  if (newStatus === 'SURGERY_COMPLETED' || newStatus === 'COMPLETED') {
    if (existingSched) {
      await qFn(
        `UPDATE surgery_schedules SET status='COMPLETED', updated_by=$1, updated_at=now()
          WHERE schedule_id=$2`,
        [userId || null, existingSched.schedule_id]
      );
    }
    return;
  }
}

// ─── changeStatus ─────────────────────────────────────────────────────────────

async function assertNotSameActor(entityId, action, actorId) {
  const { rows } = await query(
    `SELECT changed_by FROM surgery_status_history
      WHERE surgery_id=$1 AND to_status='SENT_FOR_BUDGET_APPROVAL'
      ORDER BY changed_at DESC LIMIT 1`, [entityId]
  );
  if (!rows[0] || !rows[0].changed_by) {
    throw ApiError.forbidden('The budget submitter could not be verified from status history. Resubmit the budget for approval before proceeding.');
  }
  if (actorId && rows[0].changed_by === actorId) {
    throw ApiError.forbidden(`The user who submitted this budget cannot ${action} it. A different authorized user must review it.`);
  }
}

async function assertPermissionForStatus(userId, permissionKey) {
  const { rows } = await query(
    `SELECT COALESCE(up.is_granted,rp.is_granted,FALSE) AS allowed
       FROM users u JOIN system_permissions p ON p.permission_key=$2 AND p.is_active=TRUE
       LEFT JOIN system_role_permissions rp ON rp.permission_id=p.permission_id AND rp.role_name=u.role::text
       LEFT JOIN user_permissions up ON up.user_id=u.user_id AND up.permission_id=p.permission_id
      WHERE u.user_id=$1 AND u.is_active=TRUE`, [userId,permissionKey]
  );
  const allowed = rows[0] && rows[0].allowed;
  if (!allowed) throw ApiError.forbidden(`Permission '${permissionKey}' is required for this status change.`);
}

async function changeStatus(id, newStatus, userId, notes, cancelReason) {
  const existing = await getById(id);
  const allowed  = ALLOWED_TRANSITIONS[existing.status] || [];

  if (!allowed.includes(newStatus)) {
    throw ApiError.badRequest(
      `Cannot transition from ${existing.status} → ${newStatus}. ` +
      `Allowed: ${allowed.join(', ') || 'none'}.`
    );
  }

  if (['BUDGET_APPROVED','REVISE_BUDGET'].includes(newStatus)) {
    await assertPermissionForStatus(userId, 'APPROVE_BUDGET');
    await assertNotSameActor(id, newStatus === 'BUDGET_APPROVED' ? 'approve' : 'revise', userId);
  }
  if (['SURGERY_COMPLETED','COMPLETED'].includes(newStatus)) {
    await assertPermissionForStatus(userId, 'MARK_SURGERY_COMPLETED');
  }


  // CANCELLED requires a reason
  if (newStatus === 'CANCELLED') {
    if (!cancelReason || !String(cancelReason).trim()) {
      throw ApiError.badRequest('Cancellation reason is required when cancelling a surgery.');
    }
  }

  // Hard delete (DELETED transition) only allowed from DRAFT
  if (newStatus === 'DELETED') {
    if (existing.status !== 'DRAFT') {
      throw ApiError.forbidden(
        `Cannot delete a surgery with status "${existing.status}". Only DRAFT surgeries can be deleted.`
      );
    }
  }

  // Validate budget > 0 before sending for budget approval
  if (newStatus === 'SENT_FOR_BUDGET_APPROVAL') {
    const budgetTotal = Number(existing.budgetTotal || 0);
    if (budgetTotal <= 0) {
      throw ApiError.badRequest(
        'Budget section cannot be zero before sending for Budget Approval. ' +
        'Please fill in at least one budget field.'
      );
    }
  }

  // Validate actual costs before marking surgery completed
  if (newStatus === 'SURGERY_COMPLETED' || newStatus === 'COMPLETED') {
    const ACTUAL_LABELS = {
      actualSurgeonFee: 'Surgeon Fee',
      actualOtCost:     'OT Cost',
    };
    const missing = [];
    if (existing.actualSurgeonFee === null || existing.actualSurgeonFee === undefined) missing.push(ACTUAL_LABELS.actualSurgeonFee);
    if (existing.actualOtCost     === null || existing.actualOtCost     === undefined) missing.push(ACTUAL_LABELS.actualOtCost);
    if (missing.length > 0) {
      throw ApiError.badRequest(
        `Cannot mark Surgery Completed — please save the Actual Cost fields first: ${missing.join(', ')}.`
      );
    }
  }

  // Determine if budget should be locked after this transition
  const budgetLocked = BUDGET_LOCKED_STATUSES.has(newStatus);

  return withTransaction(async (client) => {
    const setCancelReason = newStatus === 'CANCELLED' && cancelReason
      ? `, cancel_reason = $5` : '';
    const queryParams = newStatus === 'CANCELLED' && cancelReason
      ? [newStatus, budgetLocked, userId || null, id, cancelReason]
      : [newStatus, budgetLocked, userId || null, id];

    const { rows } = await client.query(
      `UPDATE surgeries
          SET status = $1, budget_locked = $2, updated_by = $3, updated_at = now()
              ${setCancelReason}
        WHERE surgery_id = $4
        RETURNING *`,
      queryParams
    );

    // Record status history
    await client.query(
      `INSERT INTO surgery_status_history (surgery_id, from_status, to_status, changed_by, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, existing.status, newStatus, userId || null, notes || null]
    ).catch(() => {/* non-fatal */});

    // Auto-sync OT schedule
    await _syncOtSchedule(id, newStatus, userId, client);

    return toRow(rows[0]);
  });
}

// ─── deleteSurgery (hard delete — DRAFT only) ─────────────────────────────────

async function deleteSurgery(id, userId) {
  const existing = await getById(id);
  if (existing.status !== 'DRAFT') {
    throw ApiError.forbidden(
      `Cannot delete a surgery with status "${existing.status}". Only DRAFT surgeries can be deleted.`
    );
  }
  await query('DELETE FROM surgeries WHERE surgery_id = $1', [id]);
  return { deleted: true, surgeryId: id };
}

async function addAssistant(surgeryId, { assistantId, feeAmount }) {
  await getById(surgeryId); // 404 guard
  const { rows } = await query(
    `INSERT INTO surgery_assistants (surgery_id, assistant_id, fee_amount)
     VALUES ($1, $2, $3)
     ON CONFLICT (surgery_id, assistant_id) DO UPDATE SET fee_amount = EXCLUDED.fee_amount
     RETURNING *`,
    [surgeryId, assistantId, feeAmount ?? 0]
  );
  return rows[0];
}

async function removeAssistant(surgeryId, assistantId) {
  const res = await query(
    'DELETE FROM surgery_assistants WHERE surgery_id = $1 AND assistant_id = $2',
    [surgeryId, assistantId]
  );
  if (res.rowCount === 0) throw ApiError.notFound('Assistant assignment not found for this surgery');
}

async function addConsumable(surgeryId, { itemId, quantity, unitCost }) {
  await getById(surgeryId);
  const { rows } = await query(
    `INSERT INTO surgery_consumables (surgery_id, item_id, quantity, unit_cost)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [surgeryId, itemId, quantity, unitCost]
  );
  return rows[0];
}

async function addPharmacy(surgeryId, { pharmacyItemId, quantity, unitCost }) {
  await getById(surgeryId);
  const { rows } = await query(
    `INSERT INTO surgery_pharmacy (surgery_id, pharmacy_item_id, quantity, unit_cost)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [surgeryId, pharmacyItemId, quantity, unitCost]
  );
  return rows[0];
}

async function addCollection(surgeryId, { amount, mode, collectedAt }, userId) {
  await getById(surgeryId);
  const { rows } = await query(
    `INSERT INTO surgery_collections (surgery_id, amount, mode, collected_at, recorded_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [surgeryId, amount, mode || null, collectedAt ? new Date(collectedAt) : new Date(), userId || null]
  );

  await query(
    `UPDATE surgeries
        SET collected_amount = (
              SELECT COALESCE(SUM(amount), 0)
                FROM surgery_collections
               WHERE surgery_id = $1
            ),
            updated_at = now()
      WHERE surgery_id = $1`,
    [surgeryId]
  );

  return rows[0];
}

module.exports = {
  ALLOWED_TRANSITIONS,
  BUDGET_LOCKED_STATUSES,
  list,
  getById,
  getByPatientId,
  create,
  update,
  changeStatus,
  deleteSurgery,
  addAssistant,
  removeAssistant,
  addConsumable,
  addPharmacy,
  addCollection,
};
