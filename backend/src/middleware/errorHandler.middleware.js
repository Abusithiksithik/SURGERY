'use strict';

const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { env } = require('../config/env');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`No route found for ${req.method} ${req.originalUrl}`));
}

/** Maps pg/PostgreSQL errors to friendly ApiErrors. */
function mapPgError(err) {
  if (err.code === '23505') {
    // unique_violation — give a user-friendly message based on the constraint
    const constraint = err.constraint || '';
    const detail = err.detail || '';
    if (constraint.includes('mr_number') || detail.includes('mr_number')) {
      return ApiError.conflict(
        'MR Number already exists. Each patient must have a unique MR Number. Please use a different MR Number or search for the existing patient record.'
      );
    }
    if (constraint.includes('username') || detail.includes('username')) {
      return ApiError.conflict('Username already exists. Please choose a different username.');
    }
    if (constraint.includes('email') || detail.includes('email')) {
      return ApiError.conflict('Email address already exists. Please use a different email.');
    }
    return ApiError.conflict(`A record with this value already exists. (${detail})`);
  }
  if (err.code === '23503') {
    // foreign_key_violation
    return ApiError.badRequest('This operation references a record that does not exist.');
  }
  if (err.code === '23502') {
    // not_null_violation
    return ApiError.badRequest(`Required field is missing: ${err.column || 'unknown'}.`);
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let apiError = err;

  if (!(apiError instanceof ApiError)) {
    apiError = mapPgError(err) || ApiError.internal(err.message || 'Unexpected error');
  }

  if (!apiError.isOperational) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.stack || err.message}`);
  } else if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${apiError.statusCode} ${apiError.message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${apiError.statusCode} ${apiError.message}`);
  }

  const body = {
    success: false,
    statusCode: apiError.statusCode,
    code: apiError.code,
    message: apiError.message,
  };
  if (apiError.details) body.details = apiError.details;
  if (env.NODE_ENV === 'development' && !apiError.isOperational) {
    body.stack = err.stack;
  }

  res.status(apiError.statusCode).json(body);
}

module.exports = { errorHandler, notFoundHandler };
