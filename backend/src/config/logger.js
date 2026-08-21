'use strict';

/**
 * Minimal structured logger. Deliberately dependency-free so the backend
 * boots with zero extra install surface; swap the implementation for
 * pino/winston in production if structured log shipping is needed —
 * every call site uses this same four-method interface, so nothing else
 * has to change.
 */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

function log(level, message, meta) {
  if (LEVELS[level] > currentLevel) return;
  const line = `${timestamp()} [${level.toUpperCase()}] ${message}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined) {
    out(line, meta);
  } else {
    out(line);
  }
}

module.exports = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};
