'use strict';

const service = require('./benchmarks.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const surgeonDashboard = asyncHandler(async (req, res) => {
  const data = await service.surgeonDashboard(req.query);
  return new ApiResponse(200, data).send(res);
});

const surgeryTypeDashboard = asyncHandler(async (req, res) => {
  const data = await service.surgeryTypeDashboard(req.query);
  return new ApiResponse(200, data).send(res);
});

const anaesthetistDashboard = asyncHandler(async (req, res) => {
  const data = await service.anaesthetistDashboard(req.query);
  return new ApiResponse(200, data).send(res);
});

const otDashboard = asyncHandler(async (req, res) => {
  const data = await service.otDashboard(req.query);
  return new ApiResponse(200, data).send(res);
});

const refresh = asyncHandler(async (req, res) => {
  const result = await service.refresh();
  return new ApiResponse(200, result, 'Materialized benchmark views refreshed').send(res);
});

module.exports = { surgeonDashboard, surgeryTypeDashboard, anaesthetistDashboard, otDashboard, refresh };
