'use strict';
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./stockInsights.service');

exports.movementReport = asyncHandler(async (req,res) => {
  const rows = await service.movementReport(req.query);
  return new ApiResponse(200, rows, 'Stock movement report').send(res);
});
exports.stockAlerts = asyncHandler(async (_req,res) => {
  const data = await service.stockAlerts();
  return new ApiResponse(200, data, 'Stock alerts').send(res);
});
