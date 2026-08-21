'use strict';

const service = require('./explorer.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const search = asyncHandler(async (req, res) => {
  const { items, meta } = await service.search(req.query);
  return new ApiResponse(200, items, 'Similar surgeries', meta).send(res);
});

const compare = asyncHandler(async (req, res) => {
  const items = await service.compare(req.body.surgeryIds);
  return new ApiResponse(200, items, 'Comparison data').send(res);
});

module.exports = { search, compare };
