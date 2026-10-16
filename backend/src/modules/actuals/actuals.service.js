'use strict';
const { query, queryOne, queryRows, withTransaction } = require('../../config/db');
const ApiError = require('../../utils/ApiError');

const snakeToCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toRow = (row) => {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([k,v]) => [snakeToCamel(k), v]));
};

async function getBySurgeryId(surgeryId) {
  const surgery = await queryOne(`
    SELECT s.surgery_id, s.surgery_number, s.status, s.surgery_date,
           p.full_name AS patient_name, p.mr_number,
           ss.planned_date, ss.planned_start_time, ss.expected_duration_min,
           ss.ot_room_id, r.room_name, r.room_code,
           ss.primary_surgeon_id, ss.co_surgeon_id, ss.anaesthetist_id
      FROM surgeries s
      JOIN patients p ON p.patient_id = s.patient_id
      LEFT JOIN surgery_schedules ss ON ss.surgery_id = s.surgery_id
        AND ss.schedule_id = (SELECT schedule_id FROM surgery_schedules WHERE surgery_id=s.surgery_id ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN ot_rooms r ON r.ot_room_id = ss.ot_room_id
     WHERE s.surgery_id = $1`, [surgeryId]);
  if (!surgery) throw ApiError.notFound('Surgery not found');

  const actual = await queryOne('SELECT * FROM surgery_actuals WHERE surgery_id = $1', [surgeryId]);
  const team = await queryRows(`
    SELECT sat.id, sat.team_role, sat.staff_id, st.name AS staff_name, st.staff_type
      FROM surgery_actual_team sat JOIN staff st ON st.staff_id = sat.staff_id
     WHERE sat.surgery_id = $1 ORDER BY sat.team_role, st.name`, [surgeryId]);
  const events = await queryRows(`
    SELECT e.*, u.full_name AS recorded_by_name
      FROM surgery_timeline_events e LEFT JOIN users u ON u.user_id=e.recorded_by
     WHERE e.surgery_id = $1 ORDER BY e.event_datetime`, [surgeryId]);

  let actualDurationMinutes = null;
  const entered = events.find(e => e.event_type === 'PATIENT_ENTERED_OT');
  const shifted = events.find(e => e.event_type === 'PATIENT_SHIFTED_OUT');
  if (entered && shifted) actualDurationMinutes = Math.max(0, Math.round((new Date(shifted.event_datetime) - new Date(entered.event_datetime)) / 60000));

  return {
    surgery: toRow(surgery),
    actual: toRow(actual),
    team: team.map(toRow),
    events: events.map(toRow),
    actualDurationMinutes,
  };
}

async function save(surgeryId, data, userId) {
  await queryOne('SELECT surgery_id FROM surgeries WHERE surgery_id=$1', [surgeryId]) || (() => { throw ApiError.notFound('Surgery not found'); })();
  return withTransaction(async (client) => {
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId || '']);
    const { team = [], ...fields } = data;
    const columns = {
      actualSurgeryDate:'actual_surgery_date', otRoomId:'ot_room_id', actualStartTime:'actual_start_time',
      procedurePerformedText:'procedure_performed_text', procedureModifiedFlag:'procedure_modified_flag',
      additionalProcedureText:'additional_procedure_text', emergencyUnplannedFlag:'emergency_unplanned_flag',
      anaesthesiaType:'anaesthesia_type', complications:'complications', equipmentUsed:'equipment_used',
      implantsUsed:'implants_used', suturesUsed:'sutures_used', staplersStaplesUsed:'staplers_staples_used',
      otherMaterialsUsed:'other_materials_used', specialInstructions:'special_instructions',
      postOpInstructions:'post_op_instructions', remarks:'remarks',
    };
    const existing = await client.query('SELECT actual_id FROM surgery_actuals WHERE surgery_id=$1', [surgeryId]);
    if (existing.rowCount === 0) {
      const names=['surgery_id'], vals=[surgeryId], placeholders=['$1'];
      for (const [k,col] of Object.entries(columns)) if (fields[k] !== undefined) { names.push(col); vals.push(fields[k] === '' ? null : fields[k]); placeholders.push(`$${vals.length}`); }
      vals.push(userId || null); names.push('created_by'); placeholders.push(`$${vals.length}`);
      vals.push(userId || null); names.push('updated_by'); placeholders.push(`$${vals.length}`);
      await client.query(`INSERT INTO surgery_actuals (${names.join(',')}) VALUES (${placeholders.join(',')})`, vals);
    } else {
      const sets=[]; vals=[];
      for (const [k,col] of Object.entries(columns)) if (fields[k] !== undefined) { vals.push(fields[k] === '' ? null : fields[k]); sets.push(`${col}=$${vals.length}`); }
      if (sets.length) { vals.push(userId || null); sets.push(`updated_by=$${vals.length}`); sets.push('updated_at=now()'); vals.push(surgeryId); await client.query(`UPDATE surgery_actuals SET ${sets.join(',')} WHERE surgery_id=$${vals.length}`, vals); }
    }
    if (Array.isArray(team)) {
      await client.query('DELETE FROM surgery_actual_team WHERE surgery_id=$1', [surgeryId]);
      for (const member of team) await client.query(
        `INSERT INTO surgery_actual_team(surgery_id,team_role,staff_id) VALUES($1,$2,$3)`,
        [surgeryId, member.teamRole, member.staffId]
      );
    }
    await client.query(`UPDATE surgeries SET surgery_date=COALESCE((SELECT actual_surgery_date FROM surgery_actuals WHERE surgery_id=$1), surgery_date), ot_in_time=COALESCE((SELECT actual_surgery_date::timestamp + actual_start_time FROM surgery_actuals WHERE surgery_id=$1), ot_in_time), updated_by=$2, updated_at=now() WHERE surgery_id=$1`, [surgeryId, userId || null]);
    return { surgeryId };
  }).then(() => getBySurgeryId(surgeryId));
}

async function addTimelineEvent(surgeryId, data, userId) {
  await queryOne('SELECT surgery_id FROM surgeries WHERE surgery_id=$1', [surgeryId]) || (() => { throw ApiError.notFound('Surgery not found'); })();
  return withTransaction(async (client) => {
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId || '']);
    const eventTime = data.eventDatetime ? new Date(data.eventDatetime) : new Date();
    await client.query(`
      INSERT INTO surgery_timeline_events(surgery_id,event_type,event_datetime,recorded_by,remarks)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(surgery_id,event_type) DO UPDATE SET event_datetime=EXCLUDED.event_datetime, recorded_by=EXCLUDED.recorded_by, remarks=EXCLUDED.remarks, updated_at=now()`,
      [surgeryId,data.eventType,eventTime,userId || null,data.remarks || null]
    );
    if (data.eventType === 'PATIENT_ENTERED_OT' || data.eventType === 'SURGERY_STARTED') {
      await client.query(`UPDATE surgeries SET ot_in_time=COALESCE((SELECT event_datetime FROM surgery_timeline_events WHERE surgery_id=$1 AND event_type='PATIENT_ENTERED_OT'), ot_in_time), updated_by=$2, updated_at=now() WHERE surgery_id=$1`, [surgeryId,userId || null]);
    }
    if (data.eventType === 'PATIENT_SHIFTED_OUT') {
      await client.query(`UPDATE surgeries SET ot_out_time=(SELECT event_datetime FROM surgery_timeline_events WHERE surgery_id=$1 AND event_type='PATIENT_SHIFTED_OUT'), updated_by=$2, updated_at=now() WHERE surgery_id=$1`, [surgeryId,userId || null]);
    }
    return { surgeryId };
  }).then(() => getBySurgeryId(surgeryId));
}

async function removeTimelineEvent(eventId, userId) {
  return withTransaction(async (client) => {
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId || '']);
    const res = await client.query('DELETE FROM surgery_timeline_events WHERE event_id=$1 RETURNING surgery_id', [eventId]);
    if (!res.rowCount) throw ApiError.notFound('Timeline event not found');
    return { deleted: true, eventId: eventId, surgeryId: res.rows[0].surgery_id };
  });
}

module.exports = { getBySurgeryId, save, addTimelineEvent, removeTimelineEvent };
