'use strict';

const { query, queryOne, queryRows } = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(s) {
  return s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
}

function toMaster(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}

// ─── Generic CRUD factory ─────────────────────────────────────────────────────

/**
 * Creates a full CRUD service for a master-data table.
 * All queries are parameterised — no string interpolation of user values.
 * Only table name, column name, and search column names are interpolated
 * (all come from trusted internal constants, never from user input).
 */
function createMasterService(tableName, idColumn, searchColumns = ['full_name']) {
  async function list(queryParams) {
    const { page, limit, skip, take } = parsePagination(queryParams);

    const conditions = [];
    const params = [];

    if (queryParams.branchId) {
      params.push(queryParams.branchId);
      conditions.push(`branch_id = $${params.length}`);
    }
    if (queryParams.isActive !== undefined) {
      params.push(queryParams.isActive === 'true' || queryParams.isActive === true);
      conditions.push(`is_active = $${params.length}`);
    }
    if (queryParams.search) {
      const searchClauses = searchColumns.map((col) => {
        params.push(`%${queryParams.search}%`);
        return `${col} ILIKE $${params.length}`;
      });
      conditions.push(`(${searchClauses.join(' OR ')})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // COUNT uses the same WHERE params (no LIMIT/OFFSET yet)
    const countRes = await query(
      `SELECT COUNT(*) FROM ${tableName} ${where}`,
      params
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);

    // Add LIMIT/OFFSET for the data query
    const limitIdx  = params.length + 1;
    const offsetIdx = params.length + 2;
    const rows = await queryRows(
      `SELECT * FROM ${tableName} ${where}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, take, skip]
    );

    return {
      items: rows.map(toMaster),
      meta:  buildPaginationMeta({ page, limit, totalCount }),
    };
  }

  async function getById(id) {
    const row = await queryOne(
      `SELECT * FROM ${tableName} WHERE ${idColumn} = $1`,
      [id]
    );
    if (!row) throw ApiError.notFound('Record not found');
    return toMaster(row);
  }

  async function create(data) {
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    if (keys.length === 0) throw ApiError.badRequest('No data provided');

    const cols         = keys.map(camelToSnake).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const vals         = keys.map((k) => data[k]);

    const { rows } = await query(
      `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders}) RETURNING *`,
      vals
    );
    return toMaster(rows[0]);
  }

  async function update(id, data) {
    await getById(id); // 404 guard

    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    if (keys.length === 0) return getById(id);

    const sets = keys.map((k, i) => `${camelToSnake(k)} = $${i + 1}`).join(', ');
    const vals = [...keys.map((k) => data[k]), id];

    const { rows } = await query(
      `UPDATE ${tableName}
          SET ${sets}, updated_at = now()
        WHERE ${idColumn} = $${keys.length + 1}
       RETURNING *`,
      vals
    );
    return toMaster(rows[0]);
  }

  async function deactivate(id) {
    await getById(id); // 404 guard
    const { rows } = await query(
      `UPDATE ${tableName}
          SET is_active = false, updated_at = now()
        WHERE ${idColumn} = $1
       RETURNING *`,
      [id]
    );
    return toMaster(rows[0]);
  }

  return { list, getById, create, update, deactivate };
}

// ─── Per-entity service instances ────────────────────────────────────────────

// ─── Activate helper (re-activate a deactivated record) ──────────────────────
function createMasterServiceWithActivate(tableName, idColumn, searchColumns = ['full_name']) {
  const base = createMasterService(tableName, idColumn, searchColumns);
  async function activate(id) {
    const { rows } = await query(
      `UPDATE ${tableName} SET is_active = true, updated_at = now()
        WHERE ${idColumn} = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) throw ApiError.notFound('Record not found');
    return toMaster(rows[0]);
  }
  return { ...base, activate };
}

const branches    = createMasterService('branches',       'branch_id',       ['branch_name', 'branch_code']);
const departments = createMasterServiceWithActivate('departments',    'department_id',    ['department_name', 'department_code']);
const surgeons    = createMasterService('surgeons',       'surgeon_id',       ['full_name', 'employee_code']);
const anaesthetists = createMasterService('anaesthetists','anaesthetist_id',  ['full_name', 'employee_code']);
const assistants  = createMasterService('assistants',     'assistant_id',     ['full_name', 'employee_code']);
const surgeryTypes = createMasterServiceWithActivate('surgery_types', 'surgery_type_id',  ['name', 'code']);
const otRooms     = createMasterServiceWithActivate('ot_rooms',       'ot_room_id',       ['room_name', 'room_code']);
const patients    = createMasterService('patients',       'patient_id',       ['full_name', 'mr_number']);
const bloodGroups = createMasterService('blood_group_options', 'blood_group_id', ['label', 'code']);
const staff       = createMasterServiceWithActivate('staff',           'staff_id',         ['name', 'employee_code']);

// Patient soft-delete: mark is_active = false.
// Does NOT remove surgical records — FK is ON DELETE RESTRICT so linked surgeries are preserved.
async function deletePatient(id) {
  const row = await queryOne('SELECT patient_id FROM patients WHERE patient_id = $1', [id]);
  if (!row) throw ApiError.notFound('Patient not found');
  const { rows } = await query(
    `UPDATE patients SET is_active = false, updated_at = now()
      WHERE patient_id = $1 RETURNING *`,
    [id]
  );
  return toMaster(rows[0]);
}

module.exports = {
  branches,
  departments,
  surgeons,
  anaesthetists,
  assistants,
  surgeryTypes,
  otRooms,
  patients,
  bloodGroups,
  staff,
  deletePatient,
};

// ─── App Users service (ADMIN only — manages system users) ───────────────────

async function listUsers(queryParams) {
  const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
  const { page, limit, skip, take } = parsePagination(queryParams);
  const params = [];
  const conds  = [];
  if (queryParams.search) {
    params.push(`%${queryParams.search}%`);
    conds.push(`(username ILIKE $${params.length} OR full_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (queryParams.isActive !== undefined) {
    params.push(queryParams.isActive === 'true' || queryParams.isActive === true);
    conds.push(`is_active = $${params.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const countRes = await query(`SELECT COUNT(*) FROM users ${where}`, params);
  const totalCount = parseInt(countRes.rows[0].count, 10);
  const rows = await queryRows(
    `SELECT user_id, branch_id, username, email, full_name, role, is_active, last_login_at, created_at
       FROM users ${where} ORDER BY created_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
    [...params, take, skip]
  );
  return { items: rows.map(toMaster), meta: buildPaginationMeta({ page, limit, totalCount }) };
}

async function getUserById(id) {
  const row = await queryOne(
    'SELECT user_id, branch_id, username, email, full_name, role, is_active, last_login_at, created_at FROM users WHERE user_id = $1',
    [id]
  );
  if (!row) throw ApiError.notFound('User not found');
  return toMaster(row);
}

async function createUser(data) {
  const bcrypt = require('bcryptjs');
  const { env } = require('../../config/env');
  if (!data.password) throw ApiError.badRequest('Password is required');
  const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS || 10);
  const { rows } = await query(
    `INSERT INTO users (branch_id, username, email, password_hash, full_name, role)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING user_id, branch_id, username, email, full_name, role, is_active`,
    [data.branchId||null, data.username, data.email, passwordHash, data.fullName, data.role||'VIEWER']
  );
  return toMaster(rows[0]);
}

async function updateUser(id, data) {
  await getUserById(id);
  const allowed = ['full_name','role','is_active','branch_id','email'];
  const sets = []; const vals = [];
  if (data.fullName  !== undefined) { sets.push(`full_name = $${sets.length+1}`);  vals.push(data.fullName); }
  if (data.role      !== undefined) { sets.push(`role = $${sets.length+1}`);        vals.push(data.role); }
  if (data.isActive  !== undefined) { sets.push(`is_active = $${sets.length+1}`);   vals.push(data.isActive); }
  if (data.branchId  !== undefined) { sets.push(`branch_id = $${sets.length+1}`);   vals.push(data.branchId); }
  if (data.email     !== undefined) { sets.push(`email = $${sets.length+1}`);       vals.push(data.email); }
  if (sets.length === 0) return getUserById(id);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE user_id = $${sets.length+1}
     RETURNING user_id, branch_id, username, email, full_name, role, is_active`,
    [...vals, id]
  );
  return toMaster(rows[0]);
}

async function deactivateUser(id) {
  const { rows } = await query(
    `UPDATE users SET is_active = false, updated_at = now() WHERE user_id = $1
     RETURNING user_id, username, is_active`,
    [id]
  );
  if (!rows[0]) throw ApiError.notFound('User not found');
  return toMaster(rows[0]);
}

module.exports.appUsers = { list: listUsers, getById: getUserById, create: createUser, update: updateUser, deactivate: deactivateUser };
