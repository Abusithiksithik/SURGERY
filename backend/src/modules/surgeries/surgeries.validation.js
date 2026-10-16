'use strict';

const Joi = require('joi');

const STATUS_VALUES = [
  'DRAFT',
  'PLANNED',
  'SENT_FOR_BUDGET_APPROVAL',
  'BUDGET_APPROVED',
  'REVISE_BUDGET',
  'SCHEDULED',
  'RESCHEDULED',
  'POSTPONED',
  'SURGERY_COMPLETED',
  'PARTIALLY_RECONCILED',
  'FULLY_RECONCILED',
  'CLOSED',
  // Legacy
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'DELETED',
];

const assistantLineSchema = Joi.object({
  assistantId: Joi.string().uuid().required(),
  feeAmount: Joi.number().min(0).required(),
});

const consumableLineSchema = Joi.object({
  itemId: Joi.string().uuid().required(),
  quantity: Joi.number().positive().required(),
  unitCost: Joi.number().min(0).required(),
});

const pharmacyLineSchema = Joi.object({
  pharmacyItemId: Joi.string().uuid().required(),
  quantity: Joi.number().positive().required(),
  unitCost: Joi.number().min(0).required(),
});

const createSurgerySchema = Joi.object({
  branchId: Joi.string().uuid().required(),
  departmentId: Joi.string().uuid().optional(),
  patientId: Joi.string().uuid().required(),
  surgeonId: Joi.string().uuid().required(),
  anaesthetistId: Joi.string().uuid().optional(),
  surgeryTypeId: Joi.string().uuid().required(),
  otRoomId: Joi.string().uuid().optional(),

  patientAgeYears: Joi.number().integer().min(0).max(130).optional(),
  patientGender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'UNKNOWN').optional(),
  anaesthesiaType: Joi.string().max(100).optional(),

  scheduledDate: Joi.date().iso().optional(),
  surgeryDate: Joi.date().iso().optional(),
  planDate: Joi.date().iso().optional(),

  ipOp: Joi.string().valid('IP', 'OP').default('OP'),
  admissionNumber: Joi.string().max(50).optional().allow('', null),
  diagnosis: Joi.string().max(1000).optional().allow('', null),
  plannedProcedure: Joi.string().max(500).optional().allow('', null),
  sideSite: Joi.string().max(100).optional().allow('', null),
  clinicalNotes: Joi.string().max(2000).optional().allow('', null),

  budgetSurgeonFee: Joi.number().min(0).default(0),
  budgetAssistantCost: Joi.number().min(0).default(0),
  budgetAnaesthetistFee: Joi.number().min(0).default(0),
  budgetOtCost: Joi.number().min(0).default(0),
  budgetConsumables: Joi.number().min(0).default(0),
  budgetPharmacy: Joi.number().min(0).default(0),
  budgetMiscellaneous: Joi.number().min(0).default(0),

  quotedPrice: Joi.number().min(0).optional(),

  comments: Joi.string().max(5000).optional().allow('', null),

  asaGrade: Joi.number().integer().min(1).max(6).optional().allow(null),
  asaEmergency: Joi.boolean().optional(),
  comorbidities: Joi.string().max(5000).optional().allow('', null),
  pacDate: Joi.date().iso().optional().allow(null),
  pacByStaffId: Joi.string().uuid().optional().allow(null),
  fitnessRemark: Joi.string().max(5000).optional().allow('', null),
  specialPrecautions: Joi.string().max(5000).optional().allow('', null),
  plannedOtType: Joi.string().valid('Major','Minor','Cath Lab').optional().allow(null),
  payerType: Joi.string().valid('SELF','INSURANCE','SCHEME','CORPORATE').optional(),
  payerName: Joi.string().max(300).optional().allow('', null),
  payerReference: Joi.string().max(300).optional().allow('', null),
  preauthAmount: Joi.number().min(0).precision(2).optional().allow(null),
  hisUhid: Joi.string().max(100).optional().allow('', null),

  assistants: Joi.array().items(assistantLineSchema).default([]),
});

const updateSurgerySchema = Joi.object({
  departmentId: Joi.string().uuid().optional(),
  surgeonId: Joi.string().uuid().optional(),
  anaesthetistId: Joi.string().uuid().optional(),
  otRoomId: Joi.string().uuid().optional(),

  patientAgeYears: Joi.number().integer().min(0).max(130).optional(),
  patientGender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'UNKNOWN').optional(),
  anaesthesiaType: Joi.string().max(100).optional(),

  scheduledDate: Joi.date().iso().optional(),
  surgeryDate: Joi.date().iso().optional(),
  planDate: Joi.date().iso().optional(),
  otInTime: Joi.date().iso().optional(),
  otOutTime: Joi.date().iso().optional(),

  ipOp: Joi.string().valid('IP', 'OP').optional(),
  admissionNumber: Joi.string().max(50).optional().allow('', null),
  diagnosis: Joi.string().max(1000).optional().allow('', null),
  plannedProcedure: Joi.string().max(500).optional().allow('', null),
  sideSite: Joi.string().max(100).optional().allow('', null),
  clinicalNotes: Joi.string().max(2000).optional().allow('', null),

  budgetSurgeonFee: Joi.number().min(0).optional(),
  budgetAssistantCost: Joi.number().min(0).optional(),
  budgetAnaesthetistFee: Joi.number().min(0).optional(),
  budgetOtCost: Joi.number().min(0).optional(),
  budgetConsumables: Joi.number().min(0).optional(),
  budgetPharmacy: Joi.number().min(0).optional(),
  budgetMiscellaneous: Joi.number().min(0).optional(),

  actualSurgeonFee: Joi.number().min(0).optional(),
  actualAssistantCost: Joi.number().min(0).optional(),
  actualAnaesthetistFee: Joi.number().min(0).optional(),
  actualOtCost: Joi.number().min(0).optional(),
  actualConsumables: Joi.number().min(0).optional(),
  actualPharmacy: Joi.number().min(0).optional(),
  actualMiscellaneous: Joi.number().min(0).optional(),

  quotedPrice: Joi.number().min(0).optional(),

  comments: Joi.string().max(5000).optional().allow('', null),

  asaGrade: Joi.number().integer().min(1).max(6).optional().allow(null),
  asaEmergency: Joi.boolean().optional(),
  comorbidities: Joi.string().max(5000).optional().allow('', null),
  pacDate: Joi.date().iso().optional().allow(null),
  pacByStaffId: Joi.string().uuid().optional().allow(null),
  fitnessRemark: Joi.string().max(5000).optional().allow('', null),
  specialPrecautions: Joi.string().max(5000).optional().allow('', null),
  plannedOtType: Joi.string().valid('Major','Minor','Cath Lab').optional().allow(null),
  payerType: Joi.string().valid('SELF','INSURANCE','SCHEME','CORPORATE').optional(),
  payerName: Joi.string().max(300).optional().allow('', null),
  payerReference: Joi.string().max(300).optional().allow('', null),
  preauthAmount: Joi.number().min(0).precision(2).optional().allow(null),
  hisUhid: Joi.string().max(100).optional().allow('', null),

  // If a budget field is being changed away from what the engine
  // recommended, the caller must say why (enforced in the service layer).
  overrideReasons: Joi.object().pattern(Joi.string(), Joi.string().max(500)).optional(),
}).min(1);

const changeStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...STATUS_VALUES)
    .required(),
  notes: Joi.string().max(1000).optional().allow('', null),
  cancelReason: Joi.string().max(1000).optional().allow('', null),
});

const addAssistantSchema = Joi.object({
  assistantId: Joi.string().uuid().required(),
  feeAmount: Joi.number().min(0).required(),
});

const addConsumableSchema = consumableLineSchema;
const addPharmacySchema = pharmacyLineSchema;

const addCollectionSchema = Joi.object({
  amount: Joi.number().positive().required(),
  mode: Joi.string().max(30).optional(),
  collectedAt: Joi.date().iso().optional(),
});

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
  status: Joi.string().valid(...STATUS_VALUES),
  surgeonId: Joi.string().uuid(),
  surgeryTypeId: Joi.string().uuid(),
  departmentId: Joi.string().uuid(),
  branchId: Joi.string().uuid(),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
  minProfit: Joi.number(),
  maxProfit: Joi.number(),
  search: Joi.string().max(150),
  sort: Joi.string(),
});

const idParamSchema = Joi.object({ id: Joi.string().uuid().required() });

module.exports = {
  STATUS_VALUES,
  createSurgerySchema,
  updateSurgerySchema,
  changeStatusSchema,
  addAssistantSchema,
  addConsumableSchema,
  addPharmacySchema,
  addCollectionSchema,
  listQuerySchema,
  idParamSchema,
};
