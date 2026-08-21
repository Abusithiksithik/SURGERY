'use strict';

require('dotenv').config();

const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  API_PREFIX: process.env.API_PREFIX || '/api/v1',

  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://postgres:12345@localhost:5432/hospital',

  SKIP_DB_INIT: process.env.SKIP_DB_INIT === 'true',

  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),

  DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE || '25', 10),
  MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE || '200', 10),

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@hospital.local',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin@12345',
  ADMIN_FULL_NAME: process.env.ADMIN_FULL_NAME || 'System Administrator',
};

function validateEnv() {
  if (env.NODE_ENV === 'production') {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
    }
  }
}

module.exports = { env, validateEnv };
