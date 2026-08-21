'use strict';

const service = require('./recommendations.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const preview = asyncHandler(async (req, res) => {
  const { surgeonId, surgeryTypeId, anaesthetistId, patientAgeYears, patientGender, packageName, departmentId, ...opts } =
    req.body;
  const target = { surgeonId, surgeryTypeId, anaesthetistId, patientAgeYears, patientGender, packageName, departmentId };
  const result = await service.preview(target, opts);
  return new ApiResponse(200, result, 'Recommendation preview generated').send(res);
});

const generateForSurgery = asyncHandler(async (req, res) => {
  const result = await service.generateForSurgery(req.params.surgeryId, req.body, req.user.userId);
  return new ApiResponse(201, result, 'Recommendation generated').send(res);
});

const getHistory = asyncHandler(async (req, res) => {
  const history = await service.getHistory(req.params.surgeryId);
  return new ApiResponse(200, history).send(res);
});

const getAcceptanceRate = asyncHandler(async (req, res) => {
  const stats = await service.getAcceptanceRate(req.query);
  return new ApiResponse(200, stats).send(res);
});

module.exports = { preview, generateForSurgery, getHistory, getAcceptanceRate };
