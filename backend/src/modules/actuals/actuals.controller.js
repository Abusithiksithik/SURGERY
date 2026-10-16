'use strict';
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./actuals.service');
exports.get = asyncHandler(async (req,res) => new ApiResponse(200, await service.getBySurgeryId(req.params.id)).send(res));
exports.save = asyncHandler(async (req,res) => new ApiResponse(200, await service.save(req.params.id, req.body, req.user.userId), 'Actuals saved').send(res));
exports.addEvent = asyncHandler(async (req,res) => new ApiResponse(200, await service.addTimelineEvent(req.params.id, req.body, req.user.userId), 'Timeline event saved').send(res));
exports.removeEvent = asyncHandler(async (req,res) => new ApiResponse(200, await service.removeTimelineEvent(req.params.id, req.user.userId), 'Timeline event removed').send(res));
