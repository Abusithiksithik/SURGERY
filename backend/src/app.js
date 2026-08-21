'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const { env } = require('./config/env');
const logger = require('./config/logger');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler.middleware');

function createApp() {
  const app = express();

  // Security & parsing middleware
  app.use(helmet());
  app.use(cors({
    origin: env.CORS_ORIGIN === '*'
      ? true  // reflect request origin — allows all with credentials
      : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  // Request logging (skipped entirely in test to keep output clean)
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined', {
      stream: { write: (msg) => logger.info(msg.trim()) },
    }));
  }

  // Global rate limiting — protects the recommendation/dashboard endpoints
  // (the most query-heavy ones) from accidental or abusive hammering.
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, statusCode: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' },
    })
  );

  // Swagger / OpenAPI docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

  // API routes
  app.use(env.API_PREFIX, routes);

  app.get('/', (req, res) => {
    res.json({
      name: 'Hospital Surgery Cost Intelligence & Recommendation Engine API',
      status: 'running',
      docs: '/api-docs',
      apiPrefix: env.API_PREFIX,
    });
  });

  // 404 + centralized error handling (must be registered last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
