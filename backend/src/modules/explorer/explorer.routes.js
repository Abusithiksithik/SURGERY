'use strict';

const express = require('express');
const controller = require('./explorer.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { searchSchema, compareSchema } = require('./explorer.validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Explorer
 *   description: Similar Surgery Explorer - browse, filter, sort, and compare historical completed surgeries
 */

/**
 * @swagger
 * /explorer/search:
 *   get:
 *     summary: Search similarity-ranked completed surgeries with filters, sorting, and pagination
 *     tags: [Explorer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: surgeryTypeId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: surgeonId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: departmentId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: minProfit
 *         schema: { type: number }
 *       - in: query
 *         name: maxProfit
 *         schema: { type: number }
 *       - in: query
 *         name: minDuration
 *         schema: { type: integer }
 *       - in: query
 *         name: maxDuration
 *         schema: { type: integer }
 *       - in: query
 *         name: minCost
 *         schema: { type: number }
 *       - in: query
 *         name: maxCost
 *         schema: { type: number }
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: 'similarityScore:desc' }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Paginated, similarity-ranked, filtered surgery list }
 */
router.get('/search', authenticate, validate({ query: searchSchema }), controller.search);

/**
 * @swagger
 * /explorer/compare:
 *   post:
 *     summary: Fetch full side-by-side detail for 2-10 specific completed surgeries
 *     tags: [Explorer]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [surgeryIds]
 *             properties:
 *               surgeryIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 minItems: 2
 *                 maxItems: 10
 *     responses:
 *       200: { description: Full detail for each requested surgery }
 *       404: { description: One or more surgeries not found or not completed }
 */
router.post('/compare', authenticate, validate({ body: compareSchema }), controller.compare);

module.exports = router;
