'use strict';

const Joi = require('joi');
const { ROLES } = require('../../constants/roles');

const registerSchema = Joi.object({
  branchId: Joi.string().uuid().optional(),
  username: Joi.string().alphanum().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  fullName: Joi.string().min(2).max(150).required(),
  role: Joi.string()
    .valid(...Object.values(ROLES))
    .default(ROLES.VIEWER),
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required(),
});

module.exports = { registerSchema, loginSchema, refreshSchema, changePasswordSchema };
