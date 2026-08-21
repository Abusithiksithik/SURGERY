'use strict';

const express = require('express');
const controller = require('./surgeries.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const rbac = require('../../middleware/rbac.middleware');
const { ROLE_GROUPS } = require('../../constants/roles');
const {
  createSurgerySchema,
  updateSurgerySchema,
  changeStatusSchema,
  addAssistantSchema,
  addConsumableSchema,
  addPharmacySchema,
  addCollectionSchema,
  listQuerySchema,
  idParamSchema,
} = require('./surgeries.validation');
const Joi = require('joi');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Surgeries
 *   description: Surgery case CRUD, budget/actual entry, status lifecycle
 */

/**
 * @swagger
 * /surgeries:
 *   get:
 *     summary: List surgeries with filters, search, sort, pagination
 *     tags: [Surgeries]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PENDING, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, DELETED] }
 *       - in: query
 *         name: surgeonId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: surgeryTypeId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, example: 'surgeryDate:desc' }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated surgery list }
 *   post:
 *     summary: Create a new surgery budget (starts as DRAFT)
 *     tags: [Surgeries]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Surgery created }
 */
router
  .route('/')
  .get(authenticate, validate({ query: listQuerySchema }), controller.list)
  .post(
    authenticate,
    rbac(ROLE_GROUPS.BUDGET_WRITERS),
    validate({ body: createSurgerySchema }),
    controller.create
  );

// Patient surgery history — must be registered BEFORE /:id to avoid Express capturing 'patient' as :id
router.get(
  '/patient/:patientId',
  authenticate,
  validate({ params: Joi.object({ patientId: Joi.string().uuid().required() }) }),
  controller.getByPatientId
);

/**
 * @swagger
 * /surgeries/{id}:
 *   get:
 *     summary: Get full surgery detail (patient, surgeon, line items, etc.)
 *     tags: [Surgeries]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Surgery detail }
 *       404: { description: Not found }
 *   put:
 *     summary: Update a surgery's budget/actual fields. If a budget field differs from the last recommendation, `overrideReasons.<field>` is required.
 *     tags: [Surgeries]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Surgery updated }
 *       400: { description: Missing override reason, or surgery is COMPLETED and locked }
 */
router
  .route('/:id')
  .get(authenticate, validate({ params: idParamSchema }), controller.getById)
  .put(
    authenticate,
    rbac(ROLE_GROUPS.BUDGET_WRITERS),
    validate({ params: idParamSchema, body: updateSurgerySchema }),
    controller.update
  )
  .delete(
    authenticate,
    rbac(ROLE_GROUPS.BUDGET_WRITERS),
    validate({ params: idParamSchema }),
    controller.deleteSurgery
  );

/**
 * @swagger
 * /surgeries/{id}/status:
 *   patch:
 *     summary: Transition a surgery's status (enforces valid lifecycle transitions)
 *     tags: [Surgeries]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [DRAFT, PENDING, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, DELETED] }
 *     responses:
 *       200: { description: Status changed }
 *       400: { description: Invalid transition, or missing actual costs required to mark COMPLETED }
 */
router.patch(
  '/:id/status',
  authenticate,
  rbac(ROLE_GROUPS.BUDGET_WRITERS),
  validate({ params: idParamSchema, body: changeStatusSchema }),
  controller.changeStatus
);

/**
 * @swagger
 * /surgeries/{id}/assistants:
 *   post:
 *     summary: Add or update an assistant assignment + fee on this surgery
 *     tags: [Surgeries]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Assistant added }
 */
router.post(
  '/:id/assistants',
  authenticate,
  rbac(ROLE_GROUPS.BUDGET_WRITERS),
  validate({ params: idParamSchema, body: addAssistantSchema }),
  controller.addAssistant
);

router.delete(
  '/:id/assistants/:assistantId',
  authenticate,
  rbac(ROLE_GROUPS.BUDGET_WRITERS),
  validate({ params: idParamSchema.keys({ assistantId: Joi.string().uuid().required() }) }),
  controller.removeAssistant
);

/**
 * @swagger
 * /surgeries/{id}/consumables:
 *   post:
 *     summary: Record a consumable item used in this surgery
 *     tags: [Surgeries]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Consumable recorded }
 */
router.post(
  '/:id/consumables',
  authenticate,
  rbac(ROLE_GROUPS.BUDGET_WRITERS),
  validate({ params: idParamSchema, body: addConsumableSchema }),
  controller.addConsumable
);

/**
 * @swagger
 * /surgeries/{id}/pharmacy:
 *   post:
 *     summary: Record a pharmacy item used in this surgery
 *     tags: [Surgeries]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Pharmacy item recorded }
 */
router.post(
  '/:id/pharmacy',
  authenticate,
  rbac(ROLE_GROUPS.BUDGET_WRITERS),
  validate({ params: idParamSchema, body: addPharmacySchema }),
  controller.addPharmacy
);

/**
 * @swagger
 * /surgeries/{id}/collections:
 *   post:
 *     summary: Record a payment collected against this surgery's quote (Finance only)
 *     tags: [Surgeries]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Collection recorded }
 */
router.post(
  '/:id/collections',
  authenticate,
  rbac(ROLE_GROUPS.FINANCE_AND_ABOVE),
  validate({ params: idParamSchema, body: addCollectionSchema }),
  controller.addCollection
);

// Status history
router.get(
  '/:id/history',
  authenticate,
  validate({ params: idParamSchema }),
  controller.getHistory
);

module.exports = router;
