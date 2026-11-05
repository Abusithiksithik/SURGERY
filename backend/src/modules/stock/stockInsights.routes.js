'use strict';
const express = require('express');
const Joi = require('joi');
const controller = require('./stockInsights.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const router = express.Router();
const uuid = Joi.string().guid({version:['uuidv4','uuidv5']});
router.get('/reports/movements', authenticate, validate({query:Joi.object({
  dateFrom:Joi.date().iso(), dateTo:Joi.date().iso(), locationId:uuid, itemId:uuid
})}), controller.movementReport);
router.get('/alerts', authenticate, controller.stockAlerts);
module.exports = router;
