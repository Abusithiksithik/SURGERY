'use strict';

/**
 * Standard application error. Every intentional error thrown anywhere in
 * the app (controllers, services, middleware) should be an ApiError so
 * the central error handler can respond consistently.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - human-readable message
   * @param {object} [options]
   * @param {string} [options.code] - machine-readable error code, e.g. 'VALIDATION_ERROR'
   * @param {any} [options.details] - extra structured detail (e.g. field-level validation errors)
   * @param {boolean} [options.isOperational] - true for expected/handled errors vs bugs
   */
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code || defaultCodeForStatus(statusCode);
    this.details = options.details;
    this.isOperational = options.isOperational !== false;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', details });
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, { code: 'FORBIDDEN' });
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message, details) {
    return new ApiError(409, message, { code: 'CONFLICT', details });
  }

  static validation(message, details) {
    return new ApiError(422, message, { code: 'VALIDATION_ERROR', details });
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, { code: 'INTERNAL_ERROR', isOperational: false });
  }
}

function defaultCodeForStatus(statusCode) {
  const map = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_ERROR',
  };
  return map[statusCode] || 'ERROR';
}

module.exports = ApiError;
