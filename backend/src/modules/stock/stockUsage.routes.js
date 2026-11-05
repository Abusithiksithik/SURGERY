'use strict';
const express = require('express');
const Joi = require('joi');
const controller = require('./stockUsage.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/permission.middleware');

const router = express.Router();
const uuid = Joi.string().guid({ version: ['uuidv4','uuidv5'] });
const issueBody = Joi.object({
  idempotencyKey: uuid.required(),
  surgeryId: uuid.required(),
  surgeryNumber: Joi.string().trim().max(30).allow('',null),
  itemId: uuid.required(),
  locationId: uuid.required(),
  quantity: Joi.number().positive().precision(3).required(),
  batchNumber: Joi.string().trim().max(120).allow('',null),
  expiryDate: Joi.date().iso().allow(null),
  serialNumber: Joi.string().trim().max(160).allow('',null),
  notes: Joi.string().max(1000).allow('',null),
}).required();
const adjustmentBody = Joi.object({
  idempotencyKey: uuid.required(),
  quantity: Joi.number().positive().precision(3).required(),
  notes: Joi.string().trim().max(1000).allow('',null),
}).required();
const handoverBody = Joi.object({ notes: Joi.string().trim().max(1000).allow('',null) }).required();

router.get('/cases', authenticate, requirePermission('ENTER_CASE_USAGE'), validate({query:Joi.object({search:Joi.string().trim().min(2).max(80).required()})}), controller.findCases);
router.get('/cases/:surgeryId', authenticate, requirePermission('ENTER_CASE_USAGE'), validate({params:Joi.object({surgeryId:uuid.required()})}), controller.getCaseUsage);
router.post('/issues', authenticate, requirePermission('ENTER_CASE_USAGE'), validate({body:issueBody}), controller.issueStock);
router.post('/:usageId/return', authenticate, requirePermission('ENTER_CASE_USAGE'), validate({params:Joi.object({usageId:uuid.required()}),body:adjustmentBody}), controller.returnStock);
router.post('/:usageId/wastage', authenticate, requirePermission('ENTER_CASE_USAGE'), validate({params:Joi.object({usageId:uuid.required()}),body:adjustmentBody}), controller.recordWastage);
router.post('/:usageId/pharmacy-handover', authenticate, requirePermission('RECORD_PHARMACY_BILL'), validate({params:Joi.object({usageId:uuid.required()}),body:handoverBody}), controller.handoverToPharmacy);

module.exports = router;
