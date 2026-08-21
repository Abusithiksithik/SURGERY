'use strict';
const Joi = require('joi');

const idParam = Joi.object({ id: Joi.string().uuid().required() });

const createSchema = Joi.object({
  surgeryId:           Joi.string().uuid().required(),
  plannedDate:         Joi.date().iso().required(),
  plannedStartTime:    Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required()
                         .messages({ 'string.pattern.base': 'plannedStartTime must be HH:MM or HH:MM:SS' }),
  expectedDurationMin: Joi.number().integer().min(1).max(720).default(60),
  otRoomId:            Joi.string().uuid().optional().allow(null, ''),
  priority:            Joi.string().valid('ROUTINE', 'URGENT', 'EMERGENCY').default('ROUTINE'),
  primarySurgeonId:    Joi.string().uuid().optional().allow(null, ''),
  coSurgeonId:         Joi.string().uuid().optional().allow(null, ''),
  assistantDoctorIds:  Joi.array().items(Joi.string().uuid()).optional().default([]),
  anaesthetistId:      Joi.string().uuid().optional().allow(null, ''),
  otherPersonnel:      Joi.string().max(500).optional().allow(null, ''),
});

const rescheduleSchema = Joi.object({
  reason:              Joi.string().min(3).max(500).required(),
  plannedDate:         Joi.date().iso().optional(),
  plannedStartTime:    Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  expectedDurationMin: Joi.number().integer().min(1).max(720).optional(),
  otRoomId:            Joi.string().uuid().optional().allow(null, ''),
  priority:            Joi.string().valid('ROUTINE', 'URGENT', 'EMERGENCY').optional(),
  primarySurgeonId:    Joi.string().uuid().optional().allow(null, ''),
  coSurgeonId:         Joi.string().uuid().optional().allow(null, ''),
  assistantDoctorIds:  Joi.array().items(Joi.string().uuid()).optional(),
  anaesthetistId:      Joi.string().uuid().optional().allow(null, ''),
  otherPersonnel:      Joi.string().max(500).optional().allow(null, ''),
});

const changeOtSchema = Joi.object({
  reason:    Joi.string().min(3).max(500).required(),
  otRoomId:  Joi.string().uuid().required(),
});

const changeTeamSchema = Joi.object({
  reason:             Joi.string().min(3).max(500).required(),
  primarySurgeonId:   Joi.string().uuid().optional().allow(null, ''),
  coSurgeonId:        Joi.string().uuid().optional().allow(null, ''),
  anaesthetistId:     Joi.string().uuid().optional().allow(null, ''),
  assistantDoctorIds: Joi.array().items(Joi.string().uuid()).optional(),
  otherPersonnel:     Joi.string().max(500).optional().allow(null, ''),
});

const postponeSchema = Joi.object({
  reason:   Joi.string().min(3).max(500).required(),
  newDate:  Joi.date().iso().optional(),
});

const cancelSchema = Joi.object({
  reason: Joi.string().min(3).max(500).required(),
});

const listQuerySchema = Joi.object({
  surgeryId: Joi.string().uuid().optional(),
  otRoomId:  Joi.string().uuid().optional(),
  dateFrom:  Joi.date().iso().optional(),
  dateTo:    Joi.date().iso().optional(),
  status:    Joi.string().valid('DRAFT','CONFIRMED','IN_PROGRESS','COMPLETED','POSTPONED','CANCELLED').optional(),
  priority:  Joi.string().valid('ROUTINE','URGENT','EMERGENCY').optional(),
  page:      Joi.number().integer().min(1).default(1),
  limit:     Joi.number().integer().min(1).max(200).default(20),
});

module.exports = {
  idParam, listQuerySchema,
  createSchema, rescheduleSchema, changeOtSchema,
  changeTeamSchema, postponeSchema, cancelSchema,
  timeDurationSchema: Joi.object({
    plannedStartTime:    Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).optional().allow('', null),
    expectedDurationMin: Joi.number().integer().min(1).max(720).optional(),
    plannedDate:         Joi.date().iso().optional(),
    otRoomId:            Joi.string().uuid().optional().allow('', null),
  }).min(1),
};
