'use strict';

const Joi = require('joi');

const generatePreviewSchema = Joi.object({
  surgeonId: Joi.string().uuid().required(),
  surgeryTypeId: Joi.string().uuid().required(),
  anaesthetistId: Joi.string().uuid().optional(),
  patientAgeYears: Joi.number().integer().min(0).max(130).optional(),
  patientGender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'UNKNOWN').optional(),
  packageName: Joi.string().max(150).optional(),
  departmentId: Joi.string().uuid().optional(),
  excludeOutliers: Joi.boolean().default(true),
  targetMarginPct: Joi.number().min(0).max(95).optional(),
  sampleLimit: Joi.number().integer().min(10).max(1000).default(200),
  weights: Joi.object({
    surgeonAndType: Joi.number().min(0).max(100),
    surgeryType: Joi.number().min(0).max(100),
    anaesthetist: Joi.number().min(0).max(100),
    ageGroup: Joi.number().min(0).max(100),
    gender: Joi.number().min(0).max(100),
    package: Joi.number().min(0).max(100),
    department: Joi.number().min(0).max(100),
  }).optional(),
});

const generateForSurgerySchema = Joi.object({
  excludeOutliers: Joi.boolean().default(true),
  targetMarginPct: Joi.number().min(0).max(95).optional(),
  sampleLimit: Joi.number().integer().min(10).max(1000).default(200),
  persist: Joi.boolean().default(true),
});

const idParamSchema = Joi.object({ id: Joi.string().uuid().required() });
const surgeryIdParamSchema = Joi.object({ surgeryId: Joi.string().uuid().required() });

const acceptanceRateQuerySchema = Joi.object({
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
  surgeonId: Joi.string().uuid(),
  branchId: Joi.string().uuid(),
});

module.exports = {
  generatePreviewSchema,
  generateForSurgerySchema,
  idParamSchema,
  surgeryIdParamSchema,
  acceptanceRateQuerySchema,
};
