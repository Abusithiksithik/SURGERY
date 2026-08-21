'use strict';
const service      = require('./scheduling.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/ApiResponse');

const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.query);
  return new ApiResponse(200, result.items, 'OK', result.meta).send(res);
});

const getBySurgery = asyncHandler(async (req, res) => {
  const schedule = await service.getBySurgeryId(req.params.id);
  return new ApiResponse(200, schedule, 'OK').send(res);
});

const getById = asyncHandler(async (req, res) => {
  const schedule = await service.getById(req.params.id);
  return new ApiResponse(200, schedule, 'OK').send(res);
});

const create = asyncHandler(async (req, res) => {
  const schedule = await service.create(req.body, req.user?.userId);
  return new ApiResponse(201, schedule, 'Schedule created').send(res);
});

const confirm = asyncHandler(async (req, res) => {
  const schedule = await service.confirm(req.params.id, req.user?.userId);
  return new ApiResponse(200, schedule, 'Schedule confirmed').send(res);
});

const reschedule = asyncHandler(async (req, res) => {
  const schedule = await service.reschedule(req.params.id, req.body, req.user?.userId);
  return new ApiResponse(200, schedule, 'Rescheduled').send(res);
});

const changeOt = asyncHandler(async (req, res) => {
  const schedule = await service.changeOt(req.params.id, req.body, req.user?.userId);
  return new ApiResponse(200, schedule, 'OT room changed').send(res);
});

const changeTeam = asyncHandler(async (req, res) => {
  const schedule = await service.changeTeam(req.params.id, req.body, req.user?.userId);
  return new ApiResponse(200, schedule, 'Team updated').send(res);
});

const postpone = asyncHandler(async (req, res) => {
  const schedule = await service.postpone(req.params.id, req.body, req.user?.userId);
  return new ApiResponse(200, schedule, 'Schedule postponed').send(res);
});

const cancel = asyncHandler(async (req, res) => {
  const schedule = await service.cancel(req.params.id, req.body, req.user?.userId);
  return new ApiResponse(200, schedule, 'Schedule cancelled').send(res);
});

const updateTimeDuration = asyncHandler(async (req, res) => {
  const schedule = await service.updateTimeDuration(req.params.id, req.body, req.user?.userId);
  return new ApiResponse(200, schedule, 'Time/Duration updated').send(res);
});

const deleteSchedule = asyncHandler(async (req, res) => {
  await service.deleteSchedule(req.params.id, req.user?.userId);
  return new ApiResponse(200, null, 'Schedule deleted').send(res);
});

const getHistory = asyncHandler(async (req, res) => {
  const history = await service.getHistory(req.params.id);
  return new ApiResponse(200, history, 'OK').send(res);
});

const getHistoryBySurgery = asyncHandler(async (req, res) => {
  const history = await service.getHistoryBySurgery(req.params.id);
  return new ApiResponse(200, history, 'OK').send(res);
});

module.exports = {
  list, getBySurgery, getById, create,
  confirm, reschedule, changeOt, changeTeam, postpone, cancel,
  updateTimeDuration, deleteSchedule,
  getHistory, getHistoryBySurgery,
};
