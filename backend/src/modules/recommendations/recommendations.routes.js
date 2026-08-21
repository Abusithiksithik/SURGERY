'use strict';

const express = require('express');
const controller = require('./recommendations.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const rbac = require('../../middleware/rbac.middleware');
const { ROLE_GROUPS } = require('../../constants/roles');
const {
  generatePreviewSchema,
  generateForSurgerySchema,
  surgeryIdParamSchema,
  acceptanceRateQuerySchema,
} = require('./recommendations.validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Recommendations
 *   description: Historical recommendation engine - surgeon fee, assistant, anaesthetist, OT, consumables, pharmacy, misc, and overall budget recommendations
 */

/**
 * @swagger
 * /recommendations/preview:
 *   post:
 *     summary: Generate a recommendation preview from a surgeon+surgery-type profile, without needing an existing surgery record
 *     tags: [Recommendations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [surgeonId, surgeryTypeId]
 *             properties:
 *               surgeonId: { type: string, format: uuid }
 *               surgeryTypeId: { type: string, format: uuid }
 *               anaesthetistId: { type: string, format: uuid }
 *               patientAgeYears: { type: integer }
 *               patientGender: { type: string, enum: [MALE, FEMALE, OTHER, UNKNOWN] }
 *               packageName: { type: string }
 *               departmentId: { type: string, format: uuid }
 *               excludeOutliers: { type: boolean, default: true }
 *               targetMarginPct: { type: number }
 *               sampleLimit: { type: integer, default: 200 }
 *               weights:
 *                 type: object
 *                 description: Optional override of similarity weights for what-if tuning
 *     responses:
 *       200: { description: Full recommendation bundle (per-component stats + overall budget/quote/margin) }
 */
router.post(
  '/preview',
  authenticate,
  validate({ body: generatePreviewSchema }),
  controller.preview
);

/**
 * @swagger
 * /recommendations/surgery/{surgeryId}:
 *   post:
 *     summary: Generate (and persist) a recommendation for an existing surgery record
 *     tags: [Recommendations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: surgeryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               excludeOutliers: { type: boolean, default: true }
 *               targetMarginPct: { type: number }
 *               persist: { type: boolean, default: true }
 *     responses:
 *       201: { description: Recommendation generated and stored as a snapshot }
 *   get:
 *     summary: Get recommendation generation history for a surgery, including which fields were overridden
 *     tags: [Recommendations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: surgeryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: List of past recommendation snapshots with their overrides }
 */
router
  .route('/surgery/:surgeryId')
  .post(
    authenticate,
    rbac(ROLE_GROUPS.BUDGET_WRITERS),
    validate({ params: surgeryIdParamSchema, body: generateForSurgerySchema }),
    controller.generateForSurgery
  )
  .get(authenticate, validate({ params: surgeryIdParamSchema }), controller.getHistory);

/**
 * @swagger
 * /recommendations/acceptance-rate:
 *   get:
 *     summary: Recommendation acceptance rate, overall and per budget component (Management/Finance)
 *     tags: [Recommendations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: surgeonId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: branchId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Acceptance rate statistics }
 */
router.get(
  '/acceptance-rate',
  authenticate,
  rbac(ROLE_GROUPS.MANAGEMENT_AND_ABOVE.concat('FINANCE')),
  validate({ query: acceptanceRateQuerySchema }),
  controller.getAcceptanceRate
);

module.exports = router;
