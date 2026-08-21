'use strict';

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const ENV_PATH = path.join(BACKEND_ROOT, '.env');
const ENV_EXAMPLE_PATH = path.join(BACKEND_ROOT, '.env.example');

/**
 * If .env doesn't exist yet, creates it by copying .env.example, so a
 * fresh clone works with `npm install && npm start` and no manual
 * "cp .env.example .env" step.
 *
 * IMPORTANT: this must be required and called before anything else
 * loads dotenv (config/env.js does `require('dotenv').config()` at
 * module-load time), otherwise the freshly created file arrives too
 * late for this process to pick up. server.js calls this as its very
 * first statement, before requiring ./app or ./config/env.
 *
 * Synchronous by design — this runs once, at the very start of process
 * boot, before anything else can happen anyway.
 */
function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) {
    return { created: false };
  }

  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    // No .env and no template to copy from — config/env.js's built-in
    // defaults will still carry a fresh local dev setup, so this is a
    // warning, not a fatal error.
    // eslint-disable-next-line no-console
    console.warn(
      '[bootstrap] No .env or .env.example found — continuing with built-in defaults.'
    );
    return { created: false };
  }

  fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
  // eslint-disable-next-line no-console
  console.log('[bootstrap] .env not found — created it from .env.example.');
  return { created: true };
}

module.exports = { ensureEnvFile, ENV_PATH, ENV_EXAMPLE_PATH };
