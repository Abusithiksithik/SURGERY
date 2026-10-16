'use strict';

const express = require('express');
const controller = require('./alerts.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const rbac = require('../../middleware/rbac.middleware');
const { requirePermission } = require('../../middleware/permission.middleware');
const { ROLE_GROUPS } = require('../../constants/roles');
const {
  surgeryIdParamSchema,
  alertIdParamSchema,
  listQuerySchema,
  thresholdSchema,
} = require('./alerts.validation');
const Joi = require('joi');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Alerts
 *   description: Intelligent real-time alerts with Green/Yellow/Red severity and configurable thresholds
 */

/**
 * @swagger
 * /alerts/surgery/{surgeryId}/evaluate:
 *   post:
 *     summary: Re-evaluate and persist alerts for a surgery against historical benchmarks
 *     tags: [Alerts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: surgeryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Alerts evaluated and stored, includes overallSeverity for badge display }
 */
router.post(
  '/surgery/:surgeryId/evaluate',
  authenticate,
  validate({ params: surgeryIdParamSchema }),
  controller.evaluateForSurgery
);

/**
 * @swagger
 * /alerts:
 *   get:
 *     summary: List alerts across all surgeries, filterable by severity/type/acknowledged
 *     tags: [Alerts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [GREEN, YELLOW, RED] }
 *       - in: query
 *         name: isAcknowledged
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated alerts list }
 */
router.get('/', authenticate, validate({ query: listQuerySchema }), controller.list);

/**
 * @swagger
 * /alerts/{id}/acknowledge:
 *   patch:
 *     summary: Acknowledge an alert
 *     tags: [Alerts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Alert acknowledged }
 */
router.patch(
  '/:id/acknowledge',
  authenticate,
  validate({ params: alertIdParamSchema }),
  controller.acknowledge
);

/**
 * @swagger
 * /alerts/thresholds:
 *   get:
 *     summary: List configured alert thresholds (Admin)
 *     tags: [Alerts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Threshold list }
 *   put:
 *     summary: Create or update a threshold for an alert type (Admin only)
 *     tags: [Alerts]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alertType]
 *             properties:
 *               branchId: { type: string, format: uuid, nullable: true, description: 'null = global default' }
 *               alertType: { type: string }
 *               yellowThresholdPct: { type: number }
 *               redThresholdPct: { type: number }
 *     responses:
 *       200: { description: Threshold saved }
 */
router
  .route('/thresholds')
  .get(
    authenticate,
    validate({ query: Joi.object({ branchId: Joi.string().uuid().optional() }) }),
    controller.listThresholds
  )
  .put(
    authenticate,
    requirePermission('EDIT_MASTERS'),
    validate({ body: thresholdSchema }),
    controller.upsertThreshold
  );

module.exports = router;
