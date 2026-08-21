'use strict';

const { Client } = require('pg');
const logger = require('../config/logger');
const { parseDatabaseUrl } = require('./parseDatabaseUrl');

// Only safe, unambiguous database identifiers are auto-created.
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * `pg` connects to the target database. `ensureDatabaseExists` creates it if missing (pg
 * will not) create the database itself. So before we ever invoke
 * Prisma, we connect to the server's always-present "postgres"
 * maintenance database with the same credentials and CREATE DATABASE
 * if the target doesn't exist yet.
 *
 * Returns the parsed connection info so callers don't need to
 * re-parse DATABASE_URL themselves.
 */
async function ensureDatabaseExists(databaseUrl) {
  const connInfo = parseDatabaseUrl(databaseUrl);

  if (!VALID_IDENTIFIER.test(connInfo.database)) {
    throw new Error(
      `Refusing to auto-create a database named "${connInfo.database}" — only letters, digits, ` +
        'and underscores are allowed for auto-creation.'
    );
  }

  const maintenanceClient = new Client({
    user: connInfo.user,
    password: connInfo.password,
    host: connInfo.host,
    port: connInfo.port,
    database: 'postgres',
    ssl: connInfo.ssl,
  });

  try {
    await maintenanceClient.connect();
  } catch (err) {
    throw new Error(
      `Could not connect to the PostgreSQL server at ${connInfo.host}:${connInfo.port} as user ` +
        `"${connInfo.user}". Make sure PostgreSQL is running and DATABASE_URL in .env is correct.\n` +
        `Original error: ${err.message}`
    );
  }

  try {
    const { rows } = await maintenanceClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      connInfo.database,
    ]);

    if (rows.length === 0) {
      logger.info(`Database "${connInfo.database}" does not exist — creating it...`);
      // Identifier validated above; CREATE DATABASE has no parameterized form.
      await maintenanceClient.query(`CREATE DATABASE "${connInfo.database}"`);
      logger.info(`Database "${connInfo.database}" created.`);
    } else {
      logger.info(`Database "${connInfo.database}" already exists.`);
    }
  } finally {
    await maintenanceClient.end();
  }

  return connInfo;
}

module.exports = { ensureDatabaseExists };
