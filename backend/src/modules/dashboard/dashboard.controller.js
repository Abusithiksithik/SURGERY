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


function camelizeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_m, c) => c.toUpperCase()), value,
  ]));
}
const otStockAlerts = asyncHandler(async (_req, res) => {
  const [fixedRaw, expiryRaw, closedRaw, configuredTargets] = await Promise.all([service.otFixedStockAlerts(), service.otExpiryAlerts(), service.closedOtExpiryAlerts(), service.listFixedStockTargets()]);
  const fixedStock = fixedRaw.map(camelizeRow);
  const expiry = expiryRaw.map(camelizeRow);
  const closedExpiry = closedRaw.map(camelizeRow);
  return new ApiResponse(200, {
    fixedStock: {
      items: fixedStock,
      yellowCount: fixedStock.filter((x) => x.severity === 'YELLOW').length,
      redCount: fixedStock.filter((x) => x.severity === 'RED').length,
      configuredCount: configuredTargets.length,
    },
    expiry: {
      items: expiry,
      expiredCount: expiry.filter((x) => x.status === 'EXPIRED').length,
      withinThreeMonthsCount: expiry.filter((x) => x.status !== 'EXPIRED').length,
      closedItems: closedExpiry,
      closedCount: closedExpiry.length,
    },
  }, 'OT stock dashboard alerts').send(res);
});
const fixedStockTargets = asyncHandler(async (_req, res) => {
  const rows = (await service.listFixedStockTargets()).map(camelizeRow);
  return new ApiResponse(200, rows, 'OT fixed stock targets').send(res);
});
const saveFixedStockTarget = asyncHandler(async (req, res) => {
  const row = await service.saveFixedStockTarget({ ...req.body, userId: req.user.userId });
  return new ApiResponse(200, camelizeRow(row), 'Fixed stock target saved').send(res);
});
const closeOtExpiryAlert = asyncHandler(async (req, res) => {
  const row = await service.closeOtExpiryAlert({ ...req.body, userId: req.user.userId });
  return new ApiResponse(201, row, 'Expiry alert closed').send(res);
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
  otStockAlerts,
  fixedStockTargets,
  saveFixedStockTarget,
  closeOtExpiryAlert,
};
