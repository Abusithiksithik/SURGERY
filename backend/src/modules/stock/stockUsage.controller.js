'use strict';
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./stockUsage.service');

exports.findCases = asyncHandler(async (req,res) => new ApiResponse(200, await service.findCase(req.query.search), 'Surgery cases').send(res));
exports.getCaseUsage = asyncHandler(async (req,res) => new ApiResponse(200, await service.getCaseUsage(req.params.surgeryId), 'Surgery stock usage').send(res));
exports.issueStock = asyncHandler(async (req,res) => {
  const data = await service.issueStock(req.body, req.user.userId);
  return new ApiResponse(data.idempotentReplay ? 200 : 201, data, data.idempotentReplay ? 'Existing stock issue returned' : 'Stock issued to surgery').send(res);
});
exports.returnStock = asyncHandler(async (req,res) => {
  const data = await service.returnStock({ ...req.body, usageId:req.params.usageId }, req.user.userId);
  return new ApiResponse(data.idempotentReplay ? 200 : 201, data, 'Stock return recorded').send(res);
});
exports.recordWastage = asyncHandler(async (req,res) => {
  const data = await service.recordWastage({ ...req.body, usageId:req.params.usageId }, req.user.userId);
  return new ApiResponse(data.idempotentReplay ? 200 : 201, data, 'Stock wastage recorded').send(res);
});
exports.handoverToPharmacy = asyncHandler(async (req,res) => {
  const data = await service.handoverToPharmacy(req.params.usageId, req.body.notes, req.user.userId);
  return new ApiResponse(data.idempotentReplay ? 200 : 201, data, 'Usage handed over to pharmacy').send(res);
});
