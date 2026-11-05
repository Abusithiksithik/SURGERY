'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./stockReceiving.service');

exports.listItems = asyncHandler(async (req, res) => {
  const data = await service.listItems(req.query.search || '');
  return new ApiResponse(200, data, 'Stock items').send(res);
});
exports.listLocations = asyncHandler(async (_req, res) => {
  const data = await service.listLocations();
  return new ApiResponse(200, data, 'Stock locations').send(res);
});
exports.createReceipt = asyncHandler(async (req, res) => {
  const data = await service.createReceipt(req.body, req.user.userId);
  return new ApiResponse(data.idempotentReplay ? 200 : 201, data, data.idempotentReplay ? 'Existing receipt returned (idempotent retry)' : 'Stock receipt created').send(res);
});
exports.listReceipts = asyncHandler(async (req, res) => {
  const result = await service.listReceipts(req.query);
  return new ApiResponse(200, result.items, 'Stock receipts', result.meta).send(res);
});
exports.getReceipt = asyncHandler(async (req, res) => {
  const data = await service.getReceipt(req.params.id);
  return new ApiResponse(200, data, 'Stock receipt details').send(res);
});
exports.getBalances = asyncHandler(async (req, res) => {
  const result = await service.getBalances(req.query);
  return new ApiResponse(200, result.items, 'Stock balances', result.meta).send(res);
});

exports.recordPhysicalCount = asyncHandler(async (req, res) => {
  const data = await service.recordPhysicalCount(req.body, req.user.userId);
  return new ApiResponse(data.idempotentReplay ? 200 : 201, data, data.idempotentReplay ? 'Existing physical count adjustment returned' : 'Physical count recorded').send(res);
});
