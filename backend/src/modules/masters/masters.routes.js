'use strict';

const express = require('express');
const controller = require('./masters.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const rbac = require('../../middleware/rbac.middleware');
const { ROLE_GROUPS } = require('../../constants/roles');
const {
  listQuerySchema,
  surgeonSchema,
  anaesthetistSchema,
  assistantSchema,
  surgeryTypeSchema,
  otRoomSchema,
  departmentSchema,
  branchSchema,
  patientSchema,
  idParamSchema,
  appUserSchema,
  appUserUpdateSchema,
  bloodGroupSchema,
} = require('./masters.validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Masters
 *   description: Reference/lookup data (surgeons, surgery types, anaesthetists, assistants, OT rooms, branches, departments)
 */

/**
 * Registers list/get/create/update/deactivate routes for one master-data
 * resource, so the seven entities below don't repeat this wiring seven
 * times. Write operations (create/update/deactivate) are Admin-only —
 * reference data changes are infrequent and high-blast-radius.
 */
function mountEntityRoutes(path, entityController, createSchema) {
  router.get(`/${path}`, authenticate, validate({ query: listQuerySchema }), entityController.list);
  router.get(
    `/${path}/:id`,
    authenticate,
    validate({ params: idParamSchema }),
    entityController.getById
  );
  router.post(
    `/${path}`,
    authenticate,
    rbac(ROLE_GROUPS.ADMIN_ONLY),
    validate({ body: createSchema }),
    entityController.create
  );
  router.put(
    `/${path}/:id`,
    authenticate,
    rbac(ROLE_GROUPS.ADMIN_ONLY),
    validate({ params: idParamSchema, body: createSchema }),
    entityController.update
  );
  router.delete(
    `/${path}/:id`,
    authenticate,
    rbac(ROLE_GROUPS.ADMIN_ONLY),
    validate({ params: idParamSchema }),
    entityController.deactivate
  );
  // Activate (re-enable deactivated record)
  if (entityController.activate) {
    router.patch(
      `/${path}/:id/activate`,
      authenticate,
      rbac(ROLE_GROUPS.ADMIN_ONLY),
      validate({ params: idParamSchema }),
      entityController.activate
    );
  }
}

/**
 * @swagger
 * /masters/surgeons:
 *   get:
 *     summary: List surgeons (paginated, searchable)
 *     tags: [Masters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: branchId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated list of surgeons }
 *   post:
 *     summary: Create a surgeon (Admin only)
 *     tags: [Masters]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Surgeon created }
 *       403: { description: Forbidden - Admin only }
 *
 * /masters/surgery-types:
 *   get:
 *     summary: List surgery types (paginated, searchable)
 *     tags: [Masters]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated list of surgery types }
 *
 * /masters/anaesthetists:
 *   get:
 *     summary: List anaesthetists
 *     tags: [Masters]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated list of anaesthetists }
 *
 * /masters/assistants:
 *   get:
 *     summary: List assistants
 *     tags: [Masters]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated list of assistants }
 *
 * /masters/ot-rooms:
 *   get:
 *     summary: List OT rooms
 *     tags: [Masters]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated list of OT rooms }
 *
 * /masters/branches:
 *   get:
 *     summary: List branches
 *     tags: [Masters]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated list of branches }
 *
 * /masters/departments:
 *   get:
 *     summary: List departments
 *     tags: [Masters]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated list of departments }
 *
 * All seven resources above additionally support:
 *   GET    /masters/{resource}/{id}       - fetch one
 *   POST   /masters/{resource}            - create (Admin only)
 *   PUT    /masters/{resource}/{id}       - update (Admin only)
 *   DELETE /masters/{resource}/{id}       - deactivate, soft delete (Admin only)
 */
mountEntityRoutes('branches', controller.branches, branchSchema);
mountEntityRoutes('departments', controller.departments, departmentSchema);
mountEntityRoutes('surgeons', controller.surgeons, surgeonSchema);
mountEntityRoutes('anaesthetists', controller.anaesthetists, anaesthetistSchema);
mountEntityRoutes('assistants', controller.assistants, assistantSchema);
mountEntityRoutes('surgery-types', controller.surgeryTypes, surgeryTypeSchema);
mountEntityRoutes('ot-rooms', controller.otRooms, otRoomSchema);

/**
 * @swagger
 * /masters/patients:
 *   get:
 *     summary: List/search patients
 *     tags: [Masters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches patient name or MR number
 *     responses:
 *       200: { description: Paginated list of patients }
 *   post:
 *     summary: Register a new patient (available to budget writers, not Admin-only, since Finance/OT staff register patients during intake)
 *     tags: [Masters]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [branchId, mrNumber, fullName]
 *             properties:
 *               branchId: { type: string, format: uuid }
 *               mrNumber: { type: string }
 *               fullName: { type: string }
 *               dateOfBirth: { type: string, format: date }
 *               gender: { type: string, enum: [MALE, FEMALE, OTHER, UNKNOWN] }
 *     responses:
 *       201: { description: Patient registered }
 */
router
  .route('/patients')
  .get(authenticate, validate({ query: listQuerySchema }), controller.patients.list)
  .post(
    authenticate,
    rbac(ROLE_GROUPS.BUDGET_WRITERS),
    validate({ body: patientSchema }),
    controller.patients.create
  );

router.get(
  '/patients/:id',
  authenticate,
  validate({ params: idParamSchema }),
  controller.patients.getById
);
router.put(
  '/patients/:id',
  authenticate,
  rbac(ROLE_GROUPS.BUDGET_WRITERS),
  validate({ params: idParamSchema, body: patientSchema }),
  controller.patients.update
);

// Patient soft-delete (marks is_active = false, preserves surgical records)
router.delete(
  '/patients/:id',
  authenticate,
  rbac(ROLE_GROUPS.BUDGET_WRITERS),
  validate({ params: idParamSchema }),
  controller.deletePatient
);

// Staff — unified staff table (Surgeon, Anaesthetist, Assistant, Technician, Other)
const { staffSchema } = require('./masters.validation');
mountEntityRoutes('staff', controller.staff, staffSchema);

// Blood Groups — Master Group config
mountEntityRoutes('blood-groups', controller.bloodGroups, bloodGroupSchema);

// App Users — ADMIN only (full CRUD)
router
  .route('/app-users')
  .get(authenticate, rbac(ROLE_GROUPS.ADMIN_ONLY), validate({ query: listQuerySchema }), controller.appUsers.list)
  .post(authenticate, rbac(ROLE_GROUPS.ADMIN_ONLY), validate({ body: appUserSchema }), controller.appUsers.create);

router
  .route('/app-users/:id')
  .get(authenticate, rbac(ROLE_GROUPS.ADMIN_ONLY), validate({ params: idParamSchema }), controller.appUsers.getById)
  .put(authenticate, rbac(ROLE_GROUPS.ADMIN_ONLY), validate({ params: idParamSchema, body: appUserUpdateSchema }), controller.appUsers.update)
  .delete(authenticate, rbac(ROLE_GROUPS.ADMIN_ONLY), validate({ params: idParamSchema }), controller.appUsers.deactivate);

module.exports = router;
