'use strict';

/**
 * Standard success response envelope, so every endpoint in the API
 * returns the same shape:
 *   { success: true, data: ..., meta?: ... }
 */
class ApiResponse {
  constructor(statusCode, data, message = 'Success', meta) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    if (meta) this.meta = meta;
  }

  send(res) {
    const { statusCode, ...body } = this;
    return res.status(statusCode).json(body);
  }
}

module.exports = ApiResponse;
