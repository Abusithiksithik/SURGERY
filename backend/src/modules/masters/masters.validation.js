'use strict';

const Joi = require('joi');

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
  search: Joi.string().allow('').max(150),
  branchId: Joi.string().uuid(),
  isActive: Joi.boolean(),
});

const surgeonSchema = Joi.object({
  branchId: Joi.string().uuid().required(),
  departmentId: Joi.string().uuid().optional(),
  employeeCode: Joi.string().max(30).optional(),
  fullName: Joi.string().min(2).max(150).required(),
  specialization: Joi.string().max(150).optional(),
});

const anaesthetistSchema = Joi.object({
  branchId: Joi.string().uuid().required(),
  employeeCode: Joi.string().max(30).optional(),
  fullName: Joi.string().min(2).max(150).required(),
});

const assistantSchema = Joi.object({
  branchId: Joi.string().uuid().required(),
  employeeCode: Joi.string().max(30).optional(),
  fullName: Joi.string().min(2).max(150).required(),
  roleTitle: Joi.string().max(100).optional(),
});

const surgeryTypeSchema = Joi.object({
  departmentId: Joi.string().uuid().optional().allow('', null),
  code: Joi.string().max(30).required(),
  name: Joi.string().max(200).required(),
  packageName: Joi.string().max(150).optional().allow('', null),
  standardDurationMinutes: Joi.number().integer().min(0).optional(),
  defaultDurationMin: Joi.number().integer().min(0).optional(),
});

const otRoomSchema = Joi.object({
  branchId: Joi.string().uuid().optional().allow('', null),
  roomCode: Joi.string().max(30).required(),
  roomName: Joi.string().max(150).required(),
  costPerMinute: Joi.number().min(0).default(0),
  roomType: Joi.string().valid('Major','Minor','Cath Lab').optional(),
});

const departmentSchema = Joi.object({
  branchId: Joi.string().uuid().required(),
  departmentCode: Joi.string().max(20).required(),
  departmentName: Joi.string().max(150).required(),
});

const branchSchema = Joi.object({
  branchCode: Joi.string().max(20).required(),
  branchName: Joi.string().max(150).required(),
  city: Joi.string().max(100).optional(),
});

const patientSchema = Joi.object({
  branchId: Joi.string().uuid().required(),
  mrNumber: Joi.string().max(30).required(),
  fullName: Joi.string().min(2).max(150).required(),
  dateOfBirth: Joi.date().iso().optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'UNKNOWN').default('UNKNOWN'),
  phone: Joi.string().max(20).optional().allow('', null),
  address: Joi.string().max(500).optional().allow('', null),
  bloodGroup: Joi.string().max(10).optional().allow('', null),
  emergencyContactName: Joi.string().max(120).optional().allow('', null),
  emergencyContactPhone: Joi.string().max(20).optional().allow('', null),
});

const idParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

const appUserSchema = Joi.object({
  branchId:  Joi.string().uuid().optional(),
  username:  Joi.string().min(3).max(60).required(),
  email:     Joi.string().email().max(120).required(),
  password:  Joi.string().min(6).max(100).required(),
  fullName:  Joi.string().min(2).max(120).required(),
  role:      Joi.string().valid('ADMIN','MANAGER','DOCTOR','FINANCE','VIEWER','OT_COORDINATOR').default('VIEWER'),
});

const appUserUpdateSchema = Joi.object({
  branchId:  Joi.string().uuid().optional(),
  email:     Joi.string().email().max(120).optional(),
  fullName:  Joi.string().min(2).max(120).optional(),
  role:      Joi.string().valid('ADMIN','MANAGER','DOCTOR','FINANCE','VIEWER','OT_COORDINATOR').optional(),
  isActive:  Joi.boolean().optional(),
});

const bloodGroupSchema = Joi.object({
  code:      Joi.string().max(10).required(),
  label:     Joi.string().max(30).required(),
  sortOrder: Joi.number().integer().min(0).default(0),
});

const staffSchema = Joi.object({
  branchId:     Joi.string().uuid().optional().allow('', null),
  name:         Joi.string().min(2).max(120).required(),
  staffType:    Joi.string().valid('Surgeon','Anaesthetist','Assistant','Technician','Other').required(),
  employeeCode: Joi.string().max(30).optional().allow('', null),
  isActive:     Joi.boolean().optional(),
});

module.exports = {
  listQuerySchema,
  surgeonSchema,
  anaesthetistSchema,
  assistantSchema,
  surgeryTypeSchema,
  otRoomSchema,
  departmentSchema,
  branchSchema,
  patientSchema,
  idParamSchema,
  appUserSchema,
  appUserUpdateSchema,
  bloodGroupSchema,
  staffSchema,
};
