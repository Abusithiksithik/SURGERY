'use strict';

const service = require('./reports.service');
const asyncHandler = require('../../utils/asyncHandler');

const exportSurgeries = asyncHandler(async (req, res) => {
  const { format, ...filters } = req.query;

  if (format === 'csv') {
    const csv = await service.buildSurgeriesCsv(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="surgeries-export-${Date.now()}.csv"`);
    return res.send(csv);
  }

  const buffer = await service.buildSurgeriesExcel(filters);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="surgeries-export-${Date.now()}.xlsx"`);
  return res.send(Buffer.from(buffer));
});

const exportDashboardPdf = asyncHandler(async (req, res) => {
  const buffer = await service.buildDashboardPdf(req.query);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="dashboard-summary-${Date.now()}.pdf"`);
  return res.send(buffer);
});

module.exports = { exportSurgeries, exportDashboardPdf };
