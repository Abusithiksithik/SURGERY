'use strict';
const express = require('express');
const Joi = require('joi');
const c = require('./audit.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/permission.middleware');
const router = express.Router();
const querySchema = Joi.object({
  surgeryId: Joi.string().uuid(),
  tableName: Joi.string().max(100),
  action: Joi.string().valid('INSERT','UPDATE','DELETE'),
  userId: Joi.string().uuid(),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(200),
});
router.get('/', authenticate, requirePermission('VIEW_AUDIT_TRAIL'), validate({ query: querySchema }), c.list);
module.exports = router;
