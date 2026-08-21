'use strict';

const express = require('express');
const controller = require('./dashboard.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { summaryQuery, topNQuery, forecastQuery } = require('./dashboard.validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Hospital-wide executive dashboard - monthly financials, top/bottom lists, comparisons, forecast
 */

/**
 * @swagger
 * /dashboard/summary:
 *   get:
 *     summary: Hospital dashboard KPI cards + monthly revenue/cost/profit/margin trend
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: departmentId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: months
 *         schema: { type: integer, default: 12 }
 *     responses:
 *       200: { description: KPI totals + monthly trend series }
 */
router.get('/summary', authenticate, validate({ query: summaryQuery }), controller.summary);

/**
 * @swagger
 * /dashboard/top-profitable:
 *   get:
 *     summary: Top N most profitable completed surgeries
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Top profitable surgeries }
 */
router.get('/top-profitable', authenticate, validate({ query: topNQuery }), controller.topProfitable);

/**
 * @swagger
 * /dashboard/lowest-margin:
 *   get:
 *     summary: Lowest-margin completed surgeries
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lowest margin surgeries }
 */
router.get('/lowest-margin', authenticate, validate({ query: topNQuery }), controller.lowestMargin);

/**
 * @swagger
 * /dashboard/highest-ot-cost:
 *   get:
 *     summary: Highest OT cost cases
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Highest OT cost cases }
 */
router.get('/highest-ot-cost', authenticate, validate({ query: topNQuery }), controller.highestOtCost);

/**
 * @swagger
 * /dashboard/highest-assistant-cost:
 *   get:
 *     summary: Highest assistant cost cases
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Highest assistant cost cases }
 */
router.get(
  '/highest-assistant-cost',
  authenticate,
  validate({ query: topNQuery }),
  controller.highestAssistantCost
);

/**
 * @swagger
 * /dashboard/highest-consumables:
 *   get:
 *     summary: Highest consumable cost cases
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Highest consumable cost cases }
 */
router.get(
  '/highest-consumables',
  authenticate,
  validate({ query: topNQuery }),
  controller.highestConsumableCases
);

/**
 * @swagger
 * /dashboard/department-comparison:
 *   get:
 *     summary: Department-wise revenue/cost/profit/margin comparison
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Department comparison }
 */
router.get(
  '/department-comparison',
  authenticate,
  validate({ query: summaryQuery }),
  controller.departmentComparison
);

/**
 * @swagger
 * /dashboard/branch-comparison:
 *   get:
 *     summary: Branch-wise revenue/cost/profit/margin comparison (multi-branch hospital)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Branch comparison }
 */
router.get(
  '/branch-comparison',
  authenticate,
  validate({ query: summaryQuery }),
  controller.branchComparison
);

/**
 * @swagger
 * /dashboard/doctor-comparison:
 *   get:
 *     summary: Doctor-wise case count/fee/profit/margin comparison
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Doctor comparison }
 */
router.get(
  '/doctor-comparison',
  authenticate,
  validate({ query: summaryQuery }),
  controller.doctorComparison
);

/**
 * @swagger
 * /dashboard/forecast:
 *   get:
 *     summary: Forecast next N months of revenue/cost/profit using trend analysis
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: metric
 *         schema: { type: string, enum: [revenue, cost, profit], default: revenue }
 *       - in: query
 *         name: periods
 *         schema: { type: integer, default: 3 }
 *     responses:
 *       200: { description: Historical series + trend + forecasted values }
 */
router.get('/forecast', authenticate, validate({ query: forecastQuery }), controller.forecast);

module.exports = router;
