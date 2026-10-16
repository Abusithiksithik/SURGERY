'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryOne, query } = require('../../config/db');
const { env } = require('../../config/env');
const ApiError = require('../../utils/ApiError');

function signAccessToken(user) {
  return jwt.sign({ sub: user.userId, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.userId, tokenType: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

function toUser(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    branchId: row.branch_id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeUser(user) {
  const { passwordHash, password_hash, ...safe } = user;
  return safe;
}

async function register(input) {
  const existing = await queryOne(
    'SELECT user_id FROM users WHERE username = $1 OR email = $2',
    [input.username, input.email]
  );
  if (existing) {
    throw ApiError.conflict('A user with this username or email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  const { rows } = await query(
    `INSERT INTO users (branch_id, username, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.branchId || null, input.username, input.email, passwordHash, input.fullName, input.role || 'VIEWER']
  );
  return sanitizeUser(toUser(rows[0]));
}

async function login({ username, password }) {
  // Ignore accidental leading/trailing whitespace in the username, but never trim passwords.
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  const row = await queryOne('SELECT * FROM users WHERE username = $1', [normalizedUsername]);
  if (!row || !row.is_active) {
    throw ApiError.unauthorized('Invalid username or password');
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid username or password');
  }

  await query('UPDATE users SET last_login_at = now() WHERE user_id = $1', [row.user_id]);

  const user = toUser(row);
  return {
    user: await getProfile(row.user_id),
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }
  if (payload.tokenType !== 'refresh') {
    throw ApiError.unauthorized('Invalid token type');
  }

  const row = await queryOne('SELECT * FROM users WHERE user_id = $1', [payload.sub]);
  if (!row || !row.is_active) {
    throw ApiError.unauthorized('User account is inactive or no longer exists');
  }

  const user = toUser(row);
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const row = await queryOne('SELECT * FROM users WHERE user_id = $1', [userId]);
  if (!row) throw ApiError.notFound('User not found');

  const valid = await bcrypt.compare(currentPassword, row.password_hash);
  if (!valid) throw ApiError.badRequest('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE user_id = $2', [
    passwordHash, userId,
  ]);
}

async function getProfile(userId) {
  const row = await queryOne('SELECT * FROM users WHERE user_id = $1', [userId]);
  if (!row) throw ApiError.notFound('User not found');
  const permissions = await query(
    `SELECT p.permission_key, CASE
       WHEN p.permission_key='MANAGE_ROLE_PERMISSIONS' AND u.role::text='ADMIN' THEN TRUE
       WHEN up.user_id IS NOT NULL THEN up.is_granted
       ELSE COALESCE(rp.is_granted,FALSE) END AS is_granted
     FROM users u CROSS JOIN system_permissions p
     LEFT JOIN system_role_permissions rp ON rp.permission_id=p.permission_id AND rp.role_name=u.role::text
     LEFT JOIN user_permissions up ON up.permission_id=p.permission_id AND up.user_id=u.user_id
     WHERE u.user_id=$1 AND p.is_active=TRUE ORDER BY p.permission_key`, [userId]
  );
  return { ...sanitizeUser(toUser(row)), permissions: permissions.rows.filter((r) => r.is_granted).map((r) => r.permission_key) };
}

module.exports = { register, login, refresh, changePassword, getProfile, sanitizeUser };
