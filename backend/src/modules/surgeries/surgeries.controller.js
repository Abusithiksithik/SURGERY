'use strict';

const service = require('./surgeries.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.list(req.query);
  return new ApiResponse(200, items, 'Surgeries list', meta).send(res);
});

const getById = asyncHandler(async (req, res) => {
  const surgery = await service.getById(req.params.id);
  return new ApiResponse(200, surgery).send(res);
});

const create = asyncHandler(async (req, res) => {
  const surgery = await service.create(req.body, req.user.userId);
  return new ApiResponse(201, surgery, 'Surgery created as DRAFT').send(res);
});

const update = asyncHandler(async (req, res) => {
  const surgery = await service.update(req.params.id, req.body, req.user.userId);
  return new ApiResponse(200, surgery, 'Surgery updated').send(res);
});

const deleteSurgery = asyncHandler(async (req, res) => {
  const result = await service.deleteSurgery(req.params.id, req.user.userId);
  return new ApiResponse(200, result, 'Surgery deleted').send(res);
});


const changeStatus = asyncHandler(async (req, res) => {
  const surgery = await service.changeStatus(
    req.params.id,
    req.body.status,
    req.user.userId,
    req.body.notes,
    req.body.cancelReason
  );
  return new ApiResponse(200, surgery, `Status changed to ${req.body.status}`).send(res);
});

const addAssistant = asyncHandler(async (req, res) => {
  const record = await service.addAssistant(req.params.id, req.body);
  return new ApiResponse(201, record, 'Assistant added').send(res);
});

const removeAssistant = asyncHandler(async (req, res) => {
  await service.removeAssistant(req.params.id, req.params.assistantId);
  return new ApiResponse(200, null, 'Assistant removed').send(res);
});

const addConsumable = asyncHandler(async (req, res) => {
  const record = await service.addConsumable(req.params.id, req.body);
  return new ApiResponse(201, record, 'Consumable added').send(res);
});

const addPharmacy = asyncHandler(async (req, res) => {
  const record = await service.addPharmacy(req.params.id, req.body);
  return new ApiResponse(201, record, 'Pharmacy item added').send(res);
});

const addCollection = asyncHandler(async (req, res) => {
  const record = await service.addCollection(req.params.id, req.body, req.user.userId);
  return new ApiResponse(201, record, 'Collection recorded').send(res);
});

const getByPatientId = asyncHandler(async (req, res) => {
  const surgeries = await service.getByPatientId(req.params.patientId);
  return new ApiResponse(200, surgeries, 'Patient surgeries').send(res);
});

const getHistory = asyncHandler(async (req, res) => {
  const { queryRows } = require('../../config/db');
  const rows = await queryRows(
    `SELECT from_status, to_status, changed_by, changed_at, notes
       FROM surgery_status_history WHERE surgery_id = $1 ORDER BY changed_at DESC`,
    [req.params.id]
  );
  return new ApiResponse(200, rows).send(res);
});

module.exports = {
  list,
  getById,
  getByPatientId,
  create,
  update,
  deleteSurgery,
  changeStatus,
  getHistory,
  addAssistant,
  removeAssistant,
  addConsumable,
  addPharmacy,
  addCollection,
};

