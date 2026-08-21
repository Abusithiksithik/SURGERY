'use strict';

const { ensureEnvFile } = require('./bootstrap/ensureEnvFile');
ensureEnvFile();

const { env, validateEnv } = require('./config/env');
const logger = require('./config/logger');
const { initializeDatabase } = require('./db/initializeDatabase');

async function bootstrapDatabaseOrExit() {
  try {
    await initializeDatabase();
  } catch (err) {
    logger.error('');
    logger.error('==================================================================');
    logger.error('  DATABASE INITIALIZATION FAILED — the server was not started.');
    logger.error('==================================================================');
    logger.error(err.message);
    logger.error('==================================================================');
    logger.error('');
    process.exit(1);
  }
}

async function main() {
  validateEnv();

  if (env.SKIP_DB_INIT) {
    logger.info('SKIP_DB_INIT is set — skipping automatic database initialization.');
  } else {
    await bootstrapDatabaseOrExit();
  }

  const createApp = require('./app');
  const { disconnectPool } = require('./config/db');

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Surgery Cost Intelligence API listening on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`API base: http://localhost:${env.PORT}${env.API_PREFIX}`);
    logger.info(`Swagger docs: http://localhost:${env.PORT}/api-docs`);
    logger.info('✓ Server Running');
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectPool();
      logger.info('Shutdown complete.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
