'use strict';

const Joi = require('joi');

const surgeonBenchmarkQuery = Joi.object({
  surgeonId: Joi.string().uuid().optional(),
  surgeryTypeId: Joi.string().uuid().optional(),
});

const surgeryTypeBenchmarkQuery = Joi.object({
  surgeryTypeId: Joi.string().uuid().optional(),
});

const anaesthetistBenchmarkQuery = Joi.object({
  anaesthetistId: Joi.string().uuid().optional(),
});

const otBenchmarkQuery = Joi.object({
  surgeryTypeId: Joi.string().uuid().optional(),
  otRoomId: Joi.string().uuid().optional(),
});

const trendQuery = Joi.object({
  branchId: Joi.string().uuid().optional(),
  departmentId: Joi.string().uuid().optional(),
  months: Joi.number().integer().min(1).max(60).default(12),
});

module.exports = {
  surgeonBenchmarkQuery,
  surgeryTypeBenchmarkQuery,
  anaesthetistBenchmarkQuery,
  otBenchmarkQuery,
  trendQuery,
};
