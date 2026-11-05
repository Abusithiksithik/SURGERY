'use strict';

const express = require('express');
const Joi = require('joi');
const controller = require('./stockReceiving.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/permission.middleware');

const router = express.Router();
const uuid = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });
const receiptLine = Joi.object({
  itemId: uuid.required(),
  quantity: Joi.number().precision(3).positive().required(),
  unitCost: Joi.number().precision(2).min(0).required(),
  batchNumber: Joi.string().trim().max(120).allow('', null),
  expiryDate: Joi.date().iso().allow(null),
  serialNumber: Joi.string().trim().max(160).allow('', null),
});
const receiptBody = Joi.object({
  receiptId: uuid.required(),
  locationId: uuid.required(),
  vendorId: uuid.allow(null),
  receiptNumber: Joi.string().trim().max(100).allow('', null),
  invoiceNumber: Joi.string().trim().max(100).allow('', null),
  invoiceDate: Joi.date().iso().allow(null),
  referenceNumber: Joi.string().trim().max(120).allow('', null),
  deviceId: Joi.string().trim().max(120).allow('', null),
  notes: Joi.string().max(2000).allow('', null),
  lines: Joi.array().items(receiptLine).min(1).max(200).required(),
}).required();
const listQuery = Joi.object({
  search: Joi.string().allow('').max(100),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});
const physicalCountBody = Joi.object({
  idempotencyKey: uuid.required(),
  locationId: uuid.required(),
  itemId: uuid.required(),
  countedQuantity: Joi.number().precision(3).min(0).required(),
  batchNumber: Joi.string().trim().max(120).allow('', null),
  expiryDate: Joi.date().iso().allow(null),
  serialNumber: Joi.string().trim().max(160).allow('', null),
  reason: Joi.string().trim().min(5).max(1000).required(),
}).required();
const balanceQuery = Joi.object({
  search: Joi.string().allow('').max(100),
  locationId: uuid,
  itemId: uuid,
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(200),
});

router.get('/items', authenticate, validate({ query: Joi.object({ search: Joi.string().allow('').max(100) }) }), controller.listItems);
router.get('/locations', authenticate, controller.listLocations);
router.get('/receipts', authenticate, validate({ query: listQuery }), controller.listReceipts);
router.get('/receipts/:id', authenticate, validate({ params: Joi.object({ id: uuid.required() }) }), controller.getReceipt);
router.get('/balance', authenticate, validate({ query: balanceQuery }), controller.getBalances);
router.post('/receipts', authenticate, requirePermission('RECEIVE_STOCK'), validate({ body: receiptBody }), controller.createReceipt);
router.post('/physical-count', authenticate, requirePermission('APPROVE_STOCK_ADJUSTMENT'), validate({ body: physicalCountBody }), controller.recordPhysicalCount);

module.exports = router;
