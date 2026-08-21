'use strict';

const service = require('./alerts.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const evaluateForSurgery = asyncHandler(async (req, res) => {
  const result = await service.evaluateForSurgery(req.params.surgeryId);
  return new ApiResponse(200, result, 'Alerts evaluated').send(res);
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.list(req.query);
  return new ApiResponse(200, items, 'Alerts list', meta).send(res);
});

const acknowledge = asyncHandler(async (req, res) => {
  const alert = await service.acknowledge(req.params.id, req.user.userId);
  return new ApiResponse(200, alert, 'Alert acknowledged').send(res);
});

const listThresholds = asyncHandler(async (req, res) => {
  const thresholds = await service.listThresholds(req.query.branchId);
  return new ApiResponse(200, thresholds).send(res);
});

const upsertThreshold = asyncHandler(async (req, res) => {
  const threshold = await service.upsertThreshold(req.body, req.user.userId);
  return new ApiResponse(200, threshold, 'Threshold saved').send(res);
});

module.exports = { evaluateForSurgery, list, acknowledge, listThresholds, upsertThreshold };
