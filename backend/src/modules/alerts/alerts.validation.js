'use strict';

const Joi = require('joi');

const surgeryIdParamSchema = Joi.object({ surgeryId: Joi.string().uuid().required() });
const alertIdParamSchema = Joi.object({ id: Joi.string().uuid().required() });

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
  severity: Joi.string().valid('GREEN', 'YELLOW', 'RED'),
  alertType: Joi.string(),
  isAcknowledged: Joi.boolean(),
  branchId: Joi.string().uuid(),
});

const thresholdSchema = Joi.object({
  branchId: Joi.string().uuid().allow(null).optional(),
  alertType: Joi.string()
    .valid(
      'SURGEON_FEE_HIGH',
      'ASSISTANT_COST_HIGH',
      'OT_DURATION_LONG',
      'OT_COST_HIGH',
      'CONSUMABLES_HIGH',
      'MARGIN_BELOW_TARGET',
      'QUOTE_TOO_LOW',
      'NEGATIVE_PROFIT',
      'BUDGET_EXCEEDED',
      'ACTUAL_COST_MISSING',
      'COLLECTION_PENDING'
    )
    .required(),
  yellowThresholdPct: Joi.number().min(0).max(500).optional(),
  redThresholdPct: Joi.number().min(0).max(500).optional(),
});

module.exports = { surgeryIdParamSchema, alertIdParamSchema, listQuerySchema, thresholdSchema };
