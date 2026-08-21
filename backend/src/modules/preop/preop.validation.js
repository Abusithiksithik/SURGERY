'use strict';

const Joi = require('joi');

const idParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

const surgeryIdParamSchema = Joi.object({
  surgeryId: Joi.string().uuid().required(),
});

const checklistItemSchema = Joi.object({
  checklistItem: Joi.string().min(1).max(200).required(),
  sortOrder: Joi.number().integer().min(1).optional(),
});

const createTemplateSchema = Joi.object({
  procedureId: Joi.string().uuid().required(),
  isActive: Joi.boolean().default(true),
  items: Joi.array().items(checklistItemSchema).optional(),
});

const updateTemplateSchema = Joi.object({
  procedureId: Joi.string().uuid().optional(),
  isActive: Joi.boolean().optional(),
  items: Joi.array().items(checklistItemSchema).optional(),
});

const replaceItemsSchema = Joi.object({
  items: Joi.array().items(checklistItemSchema).required(),
});

module.exports = {
  idParamSchema,
  surgeryIdParamSchema,
  createTemplateSchema,
  updateTemplateSchema,
  replaceItemsSchema,
};
