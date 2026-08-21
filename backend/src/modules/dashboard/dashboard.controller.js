'use strict';

const service = require('./dashboard.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const summary = asyncHandler(async (req, res) => {
  const data = await service.summary(req.query);
  return new ApiResponse(200, data).send(res);
});

const topProfitable = asyncHandler(async (req, res) => {
  const data = await service.topProfitable(req.query);
  return new ApiResponse(200, data, 'Top profitable surgeries').send(res);
});

const lowestMargin = asyncHandler(async (req, res) => {
  const data = await service.lowestMargin(req.query);
  return new ApiResponse(200, data, 'Lowest margin surgeries').send(res);
});

const highestOtCost = asyncHandler(async (req, res) => {
  const data = await service.highestOtCost(req.query);
  return new ApiResponse(200, data, 'Highest OT cost cases').send(res);
});

const highestAssistantCost = asyncHandler(async (req, res) => {
  const data = await service.highestAssistantCost(req.query);
  return new ApiResponse(200, data, 'Highest assistant cost cases').send(res);
});

const highestConsumableCases = asyncHandler(async (req, res) => {
  const data = await service.highestConsumableCases(req.query);
  return new ApiResponse(200, data, 'Highest consumable cost cases').send(res);
});

const departmentComparison = asyncHandler(async (req, res) => {
  const data = await service.departmentComparison(req.query);
  return new ApiResponse(200, data, 'Department comparison').send(res);
});

const branchComparison = asyncHandler(async (req, res) => {
  const data = await service.branchComparison(req.query);
  return new ApiResponse(200, data, 'Branch comparison').send(res);
});

const doctorComparison = asyncHandler(async (req, res) => {
  const data = await service.doctorComparison(req.query);
  return new ApiResponse(200, data, 'Doctor comparison').send(res);
});

const forecast = asyncHandler(async (req, res) => {
  const data = await service.forecast(req.query);
  return new ApiResponse(200, data, 'Forecast').send(res);
});

module.exports = {
  summary,
  topProfitable,
  lowestMargin,
  highestOtCost,
  highestAssistantCost,
  highestConsumableCases,
  departmentComparison,
  branchComparison,
  doctorComparison,
  forecast,
};
