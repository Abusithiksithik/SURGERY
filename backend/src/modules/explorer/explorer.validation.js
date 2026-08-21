'use strict';

const Joi = require('joi');

const searchSchema = Joi.object({
  surgeonId: Joi.string().uuid().optional(),
  surgeryTypeId: Joi.string().uuid().required(),
  anaesthetistId: Joi.string().uuid().optional(),
  departmentId: Joi.string().uuid().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
  minProfit: Joi.number().optional(),
  maxProfit: Joi.number().optional(),
  minDuration: Joi.number().integer().min(0).optional(),
  maxDuration: Joi.number().integer().min(0).optional(),
  minCost: Joi.number().min(0).optional(),
  maxCost: Joi.number().min(0).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(10),
  sort: Joi.string()
    .valid(
      'surgeryDate:asc',
      'surgeryDate:desc',
      'similarityScore:desc',
      'actualTotal:asc',
      'actualTotal:desc',
      'profit:asc',
      'profit:desc',
      'marginPct:asc',
      'marginPct:desc',
      'durationMinutes:asc',
      'durationMinutes:desc'
    )
    .default('similarityScore:desc'),
});

const compareSchema = Joi.object({
  surgeryIds: Joi.array().items(Joi.string().uuid()).min(2).max(10).required(),
});

module.exports = { searchSchema, compareSchema };
