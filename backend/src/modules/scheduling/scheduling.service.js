'use strict';

const { query, queryOne, queryRows, withTransaction } = require('../../config/db');
const ApiError  = require('../../utils/ApiError');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const logger = require('../../config/logger');

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Auto-snapshot pre-op checklist items for a surgery from the active template.
 * Called after schedule is created (DRAFT) or confirmed (CONFIRMED).
 * Idempotent — ON CONFLICT DO NOTHING skips duplicates.
 */
async function autoCreateChecklist(surgeryId, client) {
  const qFn = client
    ? (t, p) => client.query(t, p)
    : (t, p) => query(t, p);

  try {
    // Get surgery's procedure_id
    const { rows: [surg] } = await qFn(
      'SELECT surgery_type_id FROM surgeries WHERE surgery_id = $1',
      [surgeryId]
    );
    if (!surg?.surgery_type_id) return;

    // Find active template for this procedure
    const { rows: [template] } = await qFn(
      `SELECT template_id FROM preop_checklist_templates
       WHERE procedure_id = $1 AND is_active = true
       ORDER BY created_at DESC LIMIT 1`,
      [surg.surgery_type_id]
    );
    if (!template) return;

    // Fetch template items
    const { rows: items } = await qFn(
      `SELECT item_id, checklist_item, sort_order
       FROM preop_checklist_items
       WHERE template_id = $1 ORDER BY sort_order`,
      [template.template_id]
    );

    // Upsert each item (idempotent)
    for (const item of items) {
      await qFn(
        `INSERT INTO surgery_checklist
           (surgery_id, template_item_id, item_label, sort_order, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         ON CONFLICT (surgery_id, template_item_id) DO NOTHING`,
        [surgeryId, item.item_id, item.checklist_item, item.sort_order]
      );
    }
  } catch (err) {
    logger.warn('autoCreateChecklist (non-fatal):', err.message);
  }
}

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toRow(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[snakeToCamel(k)] = v;
  return out;
}

// ─── fetchFullSchedule — JOIN all related tables ──────────────────────────────

async function fetchFullSchedule(scheduleId, client) {
  const qFn = client
    ? (t, p) => client.query(t, p)
    : (t, p) => query(t, p);

  const { rows: [sched] } = await qFn(
    `SELECT ss.*,
            s.surgery_number,
            s.status         AS surgery_status,
            p.mr_number,
            p.full_name      AS patient_full_name,
            ps.full_name     AS primary_surgeon_name,
            ps.employee_code AS primary_surgeon_code,
            cs.full_name     AS co_surgeon_name,
            an.full_name     AS anaesthetist_name,
            r.room_name,
            r.room_code,
            r.cost_per_minute
     FROM   surgery_schedules ss
     JOIN   surgeries          s  ON s.surgery_id          = ss.surgery_id
     JOIN   patients           p  ON p.patient_id          = s.patient_id
     LEFT JOIN surgeons        ps ON ps.surgeon_id         = ss.primary_surgeon_id
     LEFT JOIN surgeons        cs ON cs.surgeon_id         = ss.co_surgeon_id
     LEFT JOIN anaesthetists   an ON an.anaesthetist_id    = ss.anaesthetist_id
     LEFT JOIN ot_rooms         r ON r.ot_room_id          = ss.ot_room_id
     WHERE  ss.schedule_id = $1`,
    [scheduleId]
  );
  if (!sched) return null;

  // Load assistant doctors
  const { rows: assistants } = await qFn(
    `SELECT ssa.assistant_id, a.full_name, a.employee_code
     FROM   surgery_schedule_assistants ssa
     JOIN   assistants a ON a.assistant_id = ssa.assistant_id
     WHERE  ssa.schedule_id = $1`,
    [scheduleId]
  );

  const result = toRow(sched);
  result.assistantDoctors = assistants.map(toRow);
  return result;
}

// ─── list ─────────────────────────────────────────────────────────────────────

async function list(params) {
  const { page, limit, skip, take } = parsePagination(params);
  const conds = []; const vals = [];

  if (params.surgeryId) {
    vals.push(params.surgeryId);
    conds.push(`ss.surgery_id = $${vals.length}`);
  }
  if (params.otRoomId) {
    vals.push(params.otRoomId);
    conds.push(`ss.ot_room_id = $${vals.length}`);
  }
  if (params.dateFrom) {
    vals.push(params.dateFrom);
    conds.push(`ss.planned_date >= $${vals.length}`);
  }
  if (params.dateTo) {
    vals.push(params.dateTo);
    conds.push(`ss.planned_date <= $${vals.length}`);
  }
  if (params.status) {
    vals.push(params.status);
    conds.push(`ss.status = $${vals.length}`);
  }
  if (params.priority) {
    vals.push(params.priority);
    conds.push(`ss.priority = $${vals.length}`);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*) FROM surgery_schedules ss ${where}`, vals
  );

  const rows = await queryRows(
    `SELECT ss.*,
            s.surgery_number,
            p.full_name   AS patient_full_name,
            p.mr_number,
            ps.full_name  AS primary_surgeon_name,
            r.room_name,
            r.room_code
     FROM   surgery_schedules ss
     JOIN   surgeries s ON s.surgery_id = ss.surgery_id
     JOIN   patients  p ON p.patient_id = s.patient_id
     LEFT JOIN surgeons ps ON ps.surgeon_id = ss.primary_surgeon_id
     LEFT JOIN ot_rooms  r ON r.ot_room_id  = ss.ot_room_id
     ${where}
     ORDER BY ss.planned_date ASC, ss.planned_start_time ASC
     LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
    [...vals, take, skip]
  );

  return {
    items: rows.map(toRow),
    meta: buildPaginationMeta({ page, limit, totalCount: parseInt(count, 10) }),
  };
}

// ─── getBySurgeryId ───────────────────────────────────────────────────────────

async function getBySurgeryId(surgeryId) {
  const row = await queryOne(
    `SELECT schedule_id FROM surgery_schedules
     WHERE surgery_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [surgeryId]
  );
  if (!row) return null;
  return fetchFullSchedule(row.schedule_id);
}

// ─── getById ──────────────────────────────────────────────────────────────────

async function getById(scheduleId) {
  const result = await fetchFullSchedule(scheduleId);
  if (!result) throw ApiError.notFound('Schedule not found');
  return result;
}

// ─── snapshot helper ──────────────────────────────────────────────────────────

async function snapshotSchedule(scheduleId, client) {
  const qFn = client
    ? (t, p) => client.query(t, p)
    : (t, p) => query(t, p);
  const { rows: [row] } = await qFn(
    'SELECT * FROM surgery_schedules WHERE schedule_id = $1', [scheduleId]
  );
  const { rows: assistants } = await qFn(
    'SELECT assistant_id FROM surgery_schedule_assistants WHERE schedule_id = $1', [scheduleId]
  );
  return { ...row, assistants: assistants.map(a => a.assistant_id) };
}

// ─── create ───────────────────────────────────────────────────────────────────

async function create(data, userId) {
  // Verify surgery exists and get surgery_number + surgery_type_id
  const surgery = await queryOne(
    'SELECT surgery_id, surgery_number, status, surgery_type_id FROM surgeries WHERE surgery_id = $1',
    [data.surgeryId]
  );
  if (!surgery) throw ApiError.notFound('Surgery not found');

  // ── Mandatory field validation ─────────────────────────────────────────────
  if (!data.otRoomId)          throw ApiError.badRequest('OT Room is required');
  if (!data.plannedDate)       throw ApiError.badRequest('Surgery Date is required');
  if (!data.plannedStartTime)  throw ApiError.badRequest('OT In Time (Start Time) is required');
  if (!data.expectedDurationMin || data.expectedDurationMin < 1)
                               throw ApiError.badRequest('Duration is required');

  // ── Check no active (non-cancelled) schedule exists ───────────────────────
  const existing = await queryOne(
    `SELECT schedule_id FROM surgery_schedules
     WHERE surgery_id = $1 AND status NOT IN ('CANCELLED')
     ORDER BY created_at DESC LIMIT 1`,
    [data.surgeryId]
  );
  if (existing) {
    throw ApiError.badRequest(
      `An active schedule already exists for this surgery. Use reschedule to update it.`
    );
  }

  // ── Overlap validation (always enforced — room is now mandatory) ───────────
  await checkOverlap(
    data.otRoomId,
    data.plannedDate,
    data.plannedStartTime,
    data.expectedDurationMin,
    null // no schedule to exclude yet
  );

  return withTransaction(async (client) => {
    const { rows: [sched] } = await client.query(
      `INSERT INTO surgery_schedules
         (surgery_id, surgery_number, planned_date, planned_start_time,
          expected_duration_min, ot_room_id, priority,
          primary_surgeon_id, co_surgeon_id, anaesthetist_id,
          other_personnel, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'DRAFT',$12,$12)
       RETURNING *`,
      [
        data.surgeryId, surgery.surgery_number,
        data.plannedDate, data.plannedStartTime,
        data.expectedDurationMin ?? 60,
        data.otRoomId     || null,
        data.priority     || 'ROUTINE',
        data.primarySurgeonId  || null,
        data.coSurgeonId       || null,
        data.anaesthetistId    || null,
        data.otherPersonnel    || null,
        userId || null,
      ]
    );

    // Insert assistant doctors
    if (Array.isArray(data.assistantDoctorIds) && data.assistantDoctorIds.length > 0) {
      for (const aid of data.assistantDoctorIds) {
        await client.query(
          'INSERT INTO surgery_schedule_assistants (schedule_id, assistant_id) VALUES ($1,$2)',
          [sched.schedule_id, aid]
        );
      }
    }

    // Record history
    await client.query(
      `INSERT INTO surgery_schedule_history
         (schedule_id, surgery_id, action, snapshot, changed_by)
       VALUES ($1,$2,'CREATED',$3,$4)`,
      [sched.schedule_id, data.surgeryId, JSON.stringify(sched), userId || null]
    );

    // Auto-snapshot pre-op checklist from the procedure's active template
    await autoCreateChecklist(data.surgeryId, client);

    return fetchFullSchedule(sched.schedule_id, client);
  });
}

// ─── _applyChange — shared update logic used by all mutating actions ──────────

async function _applyChange(scheduleId, action, data, userId, reason) {
  if (!reason && action !== 'CONFIRMED') {
    throw ApiError.badRequest(`A reason is required for action: ${action}`);
  }

  return withTransaction(async (client) => {
    const snap = await snapshotSchedule(scheduleId, client);
    if (!snap) throw ApiError.notFound('Schedule not found');

    // Record history BEFORE applying change
    await client.query(
      `INSERT INTO surgery_schedule_history
         (schedule_id, surgery_id, action, reason, snapshot, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [scheduleId, snap.surgery_id, action, reason || null, JSON.stringify(snap), userId || null]
    );

    // Build SET clause from data keys (camelCase → snake_case)
    const fieldMap = {
      plannedDate:          'planned_date',
      plannedStartTime:     'planned_start_time',
      expectedDurationMin:  'expected_duration_min',
      otRoomId:             'ot_room_id',
      priority:             'priority',
      primarySurgeonId:     'primary_surgeon_id',
      coSurgeonId:          'co_surgeon_id',
      anaesthetistId:       'anaesthetist_id',
      otherPersonnel:       'other_personnel',
      status:               'status',
    };

    const sets = []; const vals = [];
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (data[camel] !== undefined) {
        vals.push(data[camel] === '' ? null : data[camel]);
        sets.push(`${snake} = $${vals.length}`);
      }
    }
    // Always update updated_by and updated_at
    vals.push(userId || null);
    sets.push(`updated_by = $${vals.length}`);
    sets.push(`updated_at = now()`);
    vals.push(scheduleId);

    await client.query(
      `UPDATE surgery_schedules SET ${sets.join(', ')} WHERE schedule_id = $${vals.length}`,
      vals
    );

    // Replace assistants if provided
    if (Array.isArray(data.assistantDoctorIds)) {
      await client.query(
        'DELETE FROM surgery_schedule_assistants WHERE schedule_id = $1', [scheduleId]
      );
      for (const aid of data.assistantDoctorIds) {
        await client.query(
          'INSERT INTO surgery_schedule_assistants (schedule_id, assistant_id) VALUES ($1,$2)',
          [scheduleId, aid]
        );
      }
    }

    return fetchFullSchedule(scheduleId, client);
  });
}

// ─── Overlap validation ───────────────────────────────────────────────────────

/**
 * Check for overlapping OT schedules in the same room on the same date.
 * Excludes the current schedule (if scheduleId is provided).
 */
async function checkOverlap(otRoomId, plannedDate, plannedStartTime, expectedDurationMin, excludeScheduleId) {
  if (!otRoomId || !plannedDate || !plannedStartTime) return; // can't validate without these

  // Fetch all active schedules for this room on this date (excluding the current one if updating)
  const params = [otRoomId, plannedDate];
  const excludeClause = excludeScheduleId
    ? `AND schedule_id != $${params.push(excludeScheduleId)}`
    : '';

  const { rows } = await query(
    `SELECT schedule_id, planned_start_time, expected_duration_min
       FROM surgery_schedules
      WHERE ot_room_id = $1
        AND planned_date = $2
        AND status NOT IN ('CANCELLED', 'POSTPONED')
        ${excludeClause}
    `,
    params
  );

  // Convert times to minutes-since-midnight for comparison
  function toMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  const newStart = toMinutes(plannedStartTime);
  const newEnd   = newStart + (expectedDurationMin || 60);

  for (const sched of rows) {
    const existStart = toMinutes(sched.planned_start_time);
    const existEnd   = existStart + (sched.expected_duration_min || 60);

    // Overlap: new starts before existing ends AND new ends after existing starts
    if (newStart < existEnd && newEnd > existStart) {
      throw ApiError.badRequest(
        `This OT Room is already booked for the selected time slot (existing: ` +
        `${sched.planned_start_time} (${sched.expected_duration_min} min). ` +
        `Please choose a different time slot.`
      );
    }
  }
}

// ─── updateTimeDuration — restricted update (Time + Duration only) ────────────

async function updateTimeDuration(scheduleId, data, userId) {
  const existing = await fetchFullSchedule(scheduleId);
  if (!existing) throw ApiError.notFound('Schedule not found');

  const { plannedStartTime, expectedDurationMin, plannedDate, otRoomId } = data;

  const checkDate   = plannedDate || existing.plannedDate;
  const checkTime   = plannedStartTime || existing.plannedStartTime;
  const checkDur    = expectedDurationMin !== undefined ? expectedDurationMin : existing.expectedDurationMin;
  const checkRoomId = otRoomId !== undefined ? (otRoomId || null) : existing.otRoomId;

  if (checkRoomId) {
    await checkOverlap(checkRoomId, checkDate, checkTime, checkDur, scheduleId);
  }

  return withTransaction(async (client) => {
    const snap = await snapshotSchedule(scheduleId, client);

    await client.query(
      `INSERT INTO surgery_schedule_history
         (schedule_id, surgery_id, action, reason, snapshot, changed_by)
       VALUES ($1,$2,'TIME_UPDATED','OT Room/Time/Duration updated',$3,$4)`,
      [scheduleId, snap.surgery_id, JSON.stringify(snap), userId || null]
    );

    const sets = []; const vals = [];
    if (plannedStartTime !== undefined)   { vals.push(plannedStartTime);   sets.push(`planned_start_time = $${vals.length}`); }
    if (expectedDurationMin !== undefined){ vals.push(expectedDurationMin); sets.push(`expected_duration_min = $${vals.length}`); }
    if (plannedDate !== undefined)        { vals.push(plannedDate);        sets.push(`planned_date = $${vals.length}`); }
    if (otRoomId !== undefined)           { vals.push(otRoomId || null);   sets.push(`ot_room_id = $${vals.length}`); }

    if (sets.length === 0) return fetchFullSchedule(scheduleId, client);

    vals.push(userId || null);
    sets.push(`updated_by = $${vals.length}`);
    sets.push(`updated_at = now()`);
    vals.push(scheduleId);

    await client.query(
      `UPDATE surgery_schedules SET ${sets.join(', ')} WHERE schedule_id = $${vals.length}`,
      vals
    );

    return fetchFullSchedule(scheduleId, client);
  });
}

// ─── Public action methods ────────────────────────────────────────────────────

/**
 * Confirm an OT schedule:
 *  1. Set schedule status → CONFIRMED
 *  2. Sync surgery status → SCHEDULED (if currently in a schedulable status)
 *  3. Auto-snapshot pre-op checklist (idempotent)
 */
async function confirm(scheduleId, userId) {
  const result = await _applyChange(scheduleId, 'CONFIRMED', { status: 'CONFIRMED' }, userId, 'Confirmed');

  // Sync surgery status to SCHEDULED
  const SCHEDULABLE = new Set(['DRAFT', 'PENDING', 'PLANNED', 'BUDGET_APPROVED', 'RESCHEDULED', 'POSTPONED']);
  try {
    const { rows: [surg] } = await query(
      'SELECT surgery_id, status, surgery_type_id FROM surgeries WHERE surgery_id = $1',
      [result.surgeryId]
    );
    if (surg && SCHEDULABLE.has(surg.status)) {
      await query(
        `UPDATE surgeries SET status = 'SCHEDULED', updated_by = $1, updated_at = now()
         WHERE surgery_id = $2`,
        [userId || null, surg.surgery_id]
      );
      await query(
        `INSERT INTO surgery_status_history (surgery_id, from_status, to_status, changed_by, notes)
         VALUES ($1, $2, 'SCHEDULED', $3, 'OT Schedule confirmed')`,
        [surg.surgery_id, surg.status, userId || null]
      ).catch(() => {});
    }
    // Auto-create checklist snapshot
    await autoCreateChecklist(result.surgeryId, null);
  } catch (err) {
    logger.warn('confirm sync/checklist (non-fatal):', err.message);
  }

  return result;
}

const reschedule = (id, data, userId) =>
  _applyChange(id, 'RESCHEDULED', { ...data, status: 'DRAFT' }, userId, data.reason);
const changeOt  = (id, data, userId) =>
  _applyChange(id, 'OT_CHANGED',   { otRoomId: data.otRoomId }, userId, data.reason);
const changeTeam = (id, data, userId) =>
  _applyChange(id, 'TEAM_CHANGED', {
    primarySurgeonId:  data.primarySurgeonId,
    coSurgeonId:       data.coSurgeonId,
    anaesthetistId:    data.anaesthetistId,
    assistantDoctorIds: data.assistantDoctorIds,
    otherPersonnel:    data.otherPersonnel,
  }, userId, data.reason);
const postpone  = (id, data, userId) =>
  _applyChange(id, 'POSTPONED', { status: 'POSTPONED', plannedDate: data.newDate }, userId, data.reason);

/**
 * Cancel an OT schedule and sync the linked surgery status to CANCELLED.
 * Only syncs if the surgery is currently in a schedulable status
 * (SCHEDULED, RESCHEDULED, POSTPONED) so we don't clobber other statuses.
 */
async function cancel(scheduleId, data, userId) {
  const result = await _applyChange(scheduleId, 'CANCELLED', { status: 'CANCELLED' }, userId, data.reason);

  // Reverse-sync: mark the linked surgery as CANCELLED so Surgery Entry reflects it
  const SYNCABLE = new Set(['SCHEDULED', 'RESCHEDULED', 'POSTPONED']);
  try {
    const { rows: [surg] } = await query(
      `SELECT surgery_id, status FROM surgeries WHERE surgery_id = $1`,
      [result.surgeryId]
    );
    if (surg && SYNCABLE.has(surg.status)) {
      await query(
        `UPDATE surgeries
            SET status = 'CANCELLED',
                cancel_reason = $1,
                updated_by = $2,
                updated_at = now()
          WHERE surgery_id = $3`,
        [data.reason || 'OT Schedule cancelled', userId || null, surg.surgery_id]
      );
      await query(
        `INSERT INTO surgery_status_history (surgery_id, from_status, to_status, changed_by, notes)
         VALUES ($1, $2, 'CANCELLED', $3, $4)`,
        [surg.surgery_id, surg.status, userId || null, `OT Schedule cancelled: ${data.reason || ''}`]
      ).catch(() => {/* non-fatal */});
    }
  } catch (_) {/* non-fatal — schedule is already cancelled */}

  return result;
}

/**
 * Hard-delete a CANCELLED OT schedule record.
 * Does NOT touch the surgery or patient records.
 */
async function deleteSchedule(scheduleId, userId) {
  const existing = await fetchFullSchedule(scheduleId);
  if (!existing) throw ApiError.notFound('Schedule not found');
  if (existing.status !== 'CANCELLED') {
    throw ApiError.badRequest('Only CANCELLED schedules can be deleted.');
  }

  return withTransaction(async (client) => {
    // Record deletion in history before removing
    await client.query(
      `INSERT INTO surgery_schedule_history
         (schedule_id, surgery_id, action, reason, snapshot, changed_by)
       VALUES ($1, $2, 'DELETED', 'Cancelled schedule record deleted', $3, $4)`,
      [scheduleId, existing.surgeryId, JSON.stringify({ scheduleId }), userId || null]
    );
    // Remove assistants first (FK), then the schedule
    await client.query(
      'DELETE FROM surgery_schedule_assistants WHERE schedule_id = $1', [scheduleId]
    );
    await client.query(
      'DELETE FROM surgery_schedules WHERE schedule_id = $1', [scheduleId]
    );
  });
}

// ─── getHistory ───────────────────────────────────────────────────────────────

async function getHistory(scheduleId) {
  const rows = await queryRows(
    `SELECT h.*, u.full_name AS changed_by_name
     FROM   surgery_schedule_history h
     LEFT JOIN users u ON u.user_id = h.changed_by
     WHERE  h.schedule_id = $1
     ORDER BY h.changed_at DESC`,
    [scheduleId]
  );
  return rows.map(toRow);
}

// ─── getHistoryBySurgery ──────────────────────────────────────────────────────

async function getHistoryBySurgery(surgeryId) {
  const rows = await queryRows(
    `SELECT h.*, u.full_name AS changed_by_name
     FROM   surgery_schedule_history h
     LEFT JOIN users u ON u.user_id = h.changed_by
     WHERE  h.surgery_id = $1
     ORDER BY h.changed_at DESC`,
    [surgeryId]
  );
  return rows.map(toRow);
}

module.exports = {
  list, getBySurgeryId, getById, create,
  confirm, reschedule, changeOt, changeTeam, postpone, cancel, deleteSchedule,
  updateTimeDuration, checkOverlap,
  getHistory, getHistoryBySurgery,
  autoCreateChecklist,
};
