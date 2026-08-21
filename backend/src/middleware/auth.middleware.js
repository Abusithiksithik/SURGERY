'use strict';

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { queryOne } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Access token expired', { code: 'TOKEN_EXPIRED' });
    }
    throw ApiError.unauthorized('Invalid access token');
  }

  const user = await queryOne(
    'SELECT user_id, username, email, full_name, role, branch_id, is_active FROM users WHERE user_id = $1',
    [payload.sub]
  );
  if (!user || !user.is_active) {
    throw ApiError.unauthorized('User account is inactive or no longer exists');
  }

  req.user = {
    userId: user.user_id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    branchId: user.branch_id,
  };

  next();
});

const authenticateOptional = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await queryOne(
      'SELECT user_id, username, role, branch_id, is_active FROM users WHERE user_id = $1',
      [payload.sub]
    );
    if (user && user.is_active) {
      req.user = {
        userId: user.user_id,
        username: user.username,
        role: user.role,
        branchId: user.branch_id,
      };
    }
  } catch {
    // silently ignore — this endpoint doesn't require auth
  }
  next();
});

module.exports = { authenticate, authenticateOptional };
