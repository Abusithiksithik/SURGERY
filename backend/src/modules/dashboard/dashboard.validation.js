'use strict';

const Joi = require('joi');

const summaryQuery = Joi.object({
  branchId: Joi.string().uuid().optional(),
  departmentId: Joi.string().uuid().optional(),
  months: Joi.number().integer().min(1).max(60).default(12),
});

const topNQuery = Joi.object({
  branchId: Joi.string().uuid().optional(),
  limit: Joi.number().integer().min(1).max(50).default(10),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
});

const forecastQuery = Joi.object({
  branchId: Joi.string().uuid().optional(),
  metric: Joi.string().valid('revenue', 'cost', 'profit').default('revenue'),
  periods: Joi.number().integer().min(1).max(12).default(3),
});

module.exports = { summaryQuery, topNQuery, forecastQuery };
