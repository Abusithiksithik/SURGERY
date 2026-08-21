'use strict';

/**
 * Parses a postgresql:// / postgres:// connection string into the
 * discrete fields the `pg` package's Client constructor wants.
 *
 * Deliberately implemented with the built-in WHATWG URL parser instead
 * of pulling in an extra dependency — Postgres connection URLs are
 * valid URLs regardless of the scheme name, so this works without any
 * special-casing.
 *
 * @param {string} databaseUrl
 * @returns {{user: string, password: string, host: string, port: number, database: string, ssl: false|{rejectUnauthorized: boolean}}}
 */
function parseDatabaseUrl(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(
      `DATABASE_URL is not a valid connection string: "${databaseUrl}". ` +
        'Expected format: postgresql://user:password@host:port/database'
    );
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!database) {
    throw new Error('DATABASE_URL is missing a database name (the path after the final "/").');
  }

  const sslMode = parsed.searchParams.get('sslmode');
  const ssl = sslMode && sslMode !== 'disable' ? { rejectUnauthorized: false } : false;

  return {
    user: decodeURIComponent(parsed.username || 'postgres'),
    password: decodeURIComponent(parsed.password || ''),
    host: parsed.hostname || 'localhost',
    port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    database,
    ssl,
  };
}

module.exports = { parseDatabaseUrl };
