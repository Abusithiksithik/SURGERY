'use strict';

const express = require('express');
const controller = require('./benchmarks.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const rbac = require('../../middleware/rbac.middleware');
const { ROLE_GROUPS } = require('../../constants/roles');
const {
  surgeonBenchmarkQuery,
  surgeryTypeBenchmarkQuery,
  anaesthetistBenchmarkQuery,
  otBenchmarkQuery,
} = require('./benchmarks.validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Benchmarks
 *   description: Executive benchmark dashboards - surgeon, surgery type, anaesthetist, OT (backed by materialized views)
 */

/**
 * @swagger
 * /benchmarks/surgeons:
 *   get:
 *     summary: Surgeon Dashboard - average fee, profit, margin, case count, duration, fee range, monthly profit trend
 *     tags: [Benchmarks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: surgeonId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: surgeryTypeId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Surgeon benchmark data }
 */
router.get(
  '/surgeons',
  authenticate,
  validate({ query: surgeonBenchmarkQuery }),
  controller.surgeonDashboard
);

/**
 * @swagger
 * /benchmarks/surgery-types:
 *   get:
 *     summary: Surgery Dashboard - average cost/quote/actual/profit/duration, cost distribution extremes
 *     tags: [Benchmarks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: surgeryTypeId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Surgery type benchmark data }
 */
router.get(
  '/surgery-types',
  authenticate,
  validate({ query: surgeryTypeBenchmarkQuery }),
  controller.surgeryTypeDashboard
);

/**
 * @swagger
 * /benchmarks/anaesthetists:
 *   get:
 *     summary: Anaesthetist fee benchmarks, overall and by anaesthesia type
 *     tags: [Benchmarks]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Anaesthetist benchmark data }
 */
router.get(
  '/anaesthetists',
  authenticate,
  validate({ query: anaesthetistBenchmarkQuery }),
  controller.anaesthetistDashboard
);

/**
 * @swagger
 * /benchmarks/ot:
 *   get:
 *     summary: OT duration and cost benchmarks by surgery type / OT room
 *     tags: [Benchmarks]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OT benchmark data }
 */
router.get('/ot', authenticate, validate({ query: otBenchmarkQuery }), controller.otDashboard);

/**
 * @swagger
 * /benchmarks/refresh:
 *   post:
 *     summary: Force-refresh all benchmark materialized views (Admin only)
 *     tags: [Benchmarks]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Views refreshed }
 */
router.post('/refresh', authenticate, rbac(ROLE_GROUPS.ADMIN_ONLY), controller.refresh);

module.exports = router;
