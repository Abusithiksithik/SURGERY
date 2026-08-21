'use strict';

const Joi = require('joi');

const surgeryExportQuery = Joi.object({
  status: Joi.string().valid('COMPLETED', 'DRAFT', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'CANCELLED'),
  surgeonId: Joi.string().uuid(),
  surgeryTypeId: Joi.string().uuid(),
  branchId: Joi.string().uuid(),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
  format: Joi.string().valid('xlsx', 'csv').default('xlsx'),
});

const dashboardExportQuery = Joi.object({
  branchId: Joi.string().uuid(),
  months: Joi.number().integer().min(1).max(60).default(12),
});

module.exports = { surgeryExportQuery, dashboardExportQuery };
