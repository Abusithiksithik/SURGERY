'use strict';

require('dotenv').config();

const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const EXAMPLE_JWT_SECRETS = new Set(['dev-secret-change-me', 'dev-refresh-secret-change-me', 'change-me', 'changeme', 'secret', 'your-secret-here']);

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
  if (env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = String(process.env[key] || '');
    if (value.length < 32) {
      throw new Error(`${key} must be at least 32 characters in production.`);
    }
    if (EXAMPLE_JWT_SECRETS.has(value.toLowerCase()) || /^(dev-|example|replace[-_ ]?me|your[-_ ]?)/i.test(value)) {
      throw new Error(`${key} must not use an example or development secret in production.`);
    }
  }

  if (['12345', 'Admin@12345'].includes(String(process.env.ADMIN_PASSWORD || env.ADMIN_PASSWORD)) || /^(change[_ -]?me|replace[_ -]?me|example|your[-_ ]?)/i.test(String(process.env.ADMIN_PASSWORD || env.ADMIN_PASSWORD))) {
    throw new Error('ADMIN_PASSWORD must be changed from the default password before production startup.');
  }

  const databaseUrl = String(process.env.DATABASE_URL || '');
  if (/postgres(?:ql)?:\/\/[^:/]+:(?:12345|change[_ -]?me|replace[_ -]?me)@/i.test(databaseUrl)) {
    throw new Error('DATABASE_URL uses the known default database password. Configure a rotated database credential.');
  }
}

module.exports = { env, validateEnv };
