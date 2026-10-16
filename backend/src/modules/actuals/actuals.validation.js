'use strict';
const Joi = require('joi');

const eventTypes = [
  'PATIENT_ENTERED_OT','ANAESTHESIA_STARTED','SURGERY_STARTED',
  'ADDITIONAL_PROCEDURE','SURGERY_COMPLETED','ANAESTHESIA_COMPLETED','PATIENT_SHIFTED_OUT'
];
const teamRoles = ['PRIMARY_SURGEON','CO_SURGEON','ASSISTANT','ANAESTHETIST','OT_ASSISTANT','OTHER'];
const id = Joi.string().uuid().required();

const actualsSchema = Joi.object({
  actualSurgeryDate: Joi.date().iso().allow(null, ''),
  otRoomId: Joi.string().uuid().allow(null, ''),
  actualStartTime: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null, ''),
  procedurePerformedText: Joi.string().max(500).allow('', null),
  procedureModifiedFlag: Joi.boolean(),
  additionalProcedureText: Joi.string().max(2000).allow('', null),
  emergencyUnplannedFlag: Joi.boolean(),
  anaesthesiaType: Joi.string().max(100).allow('', null),
  complications: Joi.string().max(5000).allow('', null),
  equipmentUsed: Joi.string().max(5000).allow('', null),
  implantsUsed: Joi.string().max(5000).allow('', null),
  suturesUsed: Joi.string().max(5000).allow('', null),
  staplersStaplesUsed: Joi.string().max(5000).allow('', null),
  otherMaterialsUsed: Joi.string().max(5000).allow('', null),
  specialInstructions: Joi.string().max(5000).allow('', null),
  postOpInstructions: Joi.string().max(5000).allow('', null),
  remarks: Joi.string().max(5000).allow('', null),
  team: Joi.array().items(Joi.object({ teamRole: Joi.string().valid(...teamRoles).required(), staffId: id })).default([]),
}).min(1);

const timelineSchema = Joi.object({
  eventType: Joi.string().valid(...eventTypes).required(),
  eventDatetime: Joi.date().iso().optional(),
  remarks: Joi.string().max(1000).allow('', null),
});

const idParam = Joi.object({ id });
module.exports = { actualsSchema, timelineSchema, idParam, eventTypes, teamRoles };
