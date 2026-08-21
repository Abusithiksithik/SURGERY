'use strict';

const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const { env } = require('./env');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Hospital Surgery Cost Intelligence & Recommendation Engine API',
      version: '1.0.0',
      description:
        'REST API for surgery budget management, historical cost recommendations, ' +
        'benchmarking, alerting, and executive dashboards. All endpoints except ' +
        '/auth/register, /auth/login, and /auth/refresh require a Bearer access token.',
      contact: { name: 'Hospital ERP Engineering' },
    },
    servers: [{ url: env.API_PREFIX, description: 'Current environment' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [path.join(__dirname, '..', 'modules', '**', '*.routes.js')],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
