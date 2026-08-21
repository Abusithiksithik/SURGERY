'use strict';

const express = require('express');
const controller = require('./reports.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const rbac = require('../../middleware/rbac.middleware');
const { ROLE_GROUPS } = require('../../constants/roles');
const { surgeryExportQuery, dashboardExportQuery } = require('./reports.validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Export to Excel / CSV / PDF, and print-friendly data
 */

/**
 * @swagger
 * /reports/surgeries:
 *   get:
 *     summary: Export the surgery list to Excel (.xlsx) or CSV
 *     tags: [Reports]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [xlsx, csv], default: xlsx }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: surgeonId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: File download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet: {}
 *           text/csv: {}
 */
router.get(
  '/surgeries',
  authenticate,
  rbac(ROLE_GROUPS.FINANCE_AND_ABOVE.concat('MANAGEMENT')),
  validate({ query: surgeryExportQuery }),
  controller.exportSurgeries
);

/**
 * @swagger
 * /reports/dashboard.pdf:
 *   get:
 *     summary: Export a one-page PDF summary of the hospital dashboard
 *     tags: [Reports]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: months
 *         schema: { type: integer, default: 12 }
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf: {}
 */
router.get(
  '/dashboard.pdf',
  authenticate,
  rbac(ROLE_GROUPS.FINANCE_AND_ABOVE.concat('MANAGEMENT')),
  validate({ query: dashboardExportQuery }),
  controller.exportDashboardPdf
);

module.exports = router;
