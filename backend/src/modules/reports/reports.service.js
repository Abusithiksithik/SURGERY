'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { queryRows } = require('../../config/db');
const dashboardService = require('../dashboard/dashboard.service');

const SURGERY_COLUMNS = [
  { header: 'Date', key: 'surgeryDate', width: 14 },
  { header: 'MR Number', key: 'mrNumber', width: 14 },
  { header: 'Patient', key: 'patientName', width: 22 },
  { header: 'Surgeon', key: 'surgeonName', width: 22 },
  { header: 'Surgery Type', key: 'surgeryTypeName', width: 26 },
  { header: 'Anaesthetist', key: 'anaesthetistName', width: 22 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Duration (min)', key: 'durationMinutes', width: 14 },
  { header: 'Budget Total', key: 'budgetTotal', width: 14 },
  { header: 'Actual Total', key: 'actualTotal', width: 14 },
  { header: 'Quoted Price', key: 'quotedPrice', width: 14 },
  { header: 'Collected', key: 'collectedAmount', width: 14 },
  { header: 'Profit', key: 'profitAmount', width: 14 },
];

async function fetchSurgeriesForExport(filters) {
  const conditions = ["s.status != 'DELETED'"];
  const params = [];
  let idx = 1;

  if (filters.status) { conditions[0] = `s.status = $${idx++}`; params.push(filters.status); }
  if (filters.surgeonId) { conditions.push(`s.surgeon_id = $${idx++}`); params.push(filters.surgeonId); }
  if (filters.surgeryTypeId) { conditions.push(`s.surgery_type_id = $${idx++}`); params.push(filters.surgeryTypeId); }
  if (filters.branchId) { conditions.push(`s.branch_id = $${idx++}`); params.push(filters.branchId); }
  if (filters.dateFrom) { conditions.push(`s.surgery_date >= $${idx++}`); params.push(new Date(filters.dateFrom)); }
  if (filters.dateTo) { conditions.push(`s.surgery_date <= $${idx++}`); params.push(new Date(filters.dateTo)); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  params.push(10000);
  const rows = await queryRows(
    `SELECT s.surgery_number, s.surgery_date, s.status, s.duration_minutes, s.budget_total, s.actual_total,
            s.quoted_price, s.collected_amount, s.profit_amount,
            p.mr_number, p.full_name AS patient_name,
            sg.full_name AS surgeon_name, st.name AS surgery_type_name,
            an.full_name AS anaesthetist_name
     FROM surgeries s
     JOIN patients p ON p.patient_id = s.patient_id
     JOIN surgeons sg ON sg.surgeon_id = s.surgeon_id
     JOIN surgery_types st ON st.surgery_type_id = s.surgery_type_id
     LEFT JOIN anaesthetists an ON an.anaesthetist_id = s.anaesthetist_id
     ${where} ORDER BY s.surgery_date DESC LIMIT $${idx}`,
    params
  );

  return rows.map((s) => ({
    surgeryNumber: s.surgery_number || '',
    surgeryDate: s.surgery_date ? new Date(s.surgery_date).toISOString().slice(0, 10) : '',
    mrNumber: s.mr_number || '',
    patientName: s.patient_name || '',
    surgeonName: s.surgeon_name || '',
    surgeryTypeName: s.surgery_type_name || '',
    anaesthetistName: s.anaesthetist_name || '',
    status: s.status,
    durationMinutes: s.duration_minutes ?? '',
    budgetTotal: Number(s.budget_total) || 0,
    actualTotal: s.actual_total !== null ? Number(s.actual_total) : '',
    quotedPrice: s.quoted_price !== null ? Number(s.quoted_price) : '',
    collectedAmount: Number(s.collected_amount) || 0,
    profitAmount: s.profit_amount !== null ? Number(s.profit_amount) : '',
  }));
}

async function buildSurgeriesExcel(filters) {
  const rows = await fetchSurgeriesForExport(filters);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hospital Surgery Cost Intelligence';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Surgeries');
  sheet.columns = SURGERY_COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5EAF5' } };
  sheet.addRows(rows);
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(65 + SURGERY_COLUMNS.length - 1)}1` };
  return workbook.xlsx.writeBuffer();
}

async function buildSurgeriesCsv(filters) {
  const rows = await fetchSurgeriesForExport(filters);
  const header = SURGERY_COLUMNS.map((c) => c.header).join(',');
  const lines = rows.map((r) => SURGERY_COLUMNS.map((c) => csvEscape(r[c.key])).join(','));
  return [header, ...lines].join('\n');
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

async function buildDashboardPdf(filters) {
  const { kpis, monthlyTrend } = await dashboardService.summary({
    branchId: filters.branchId,
    departmentId: undefined,
    months: filters.months,
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Hospital Surgery Cost Intelligence — Dashboard Summary', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(1);
    doc.fillColor('#000').fontSize(13).text('Key Metrics', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total Cases: ${kpis.caseCount}`);
    doc.text(`Total Revenue: ${fmt(kpis.totalRevenue)}`);
    doc.text(`Total Cost: ${fmt(kpis.totalCost)}`);
    doc.text(`Total Profit: ${fmt(kpis.totalProfit)}`);
    doc.text(`Overall Margin: ${kpis.overallMarginPct ?? 'N/A'}%`);
    doc.text(`Pending Collection: ${fmt(kpis.pendingCollection)}`);
    doc.moveDown(1);
    doc.fontSize(13).text('Monthly Trend', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);
    const colX = [50, 150, 260, 360, 460];
    doc.text('Month', colX[0], doc.y, { continued: false });
    doc.text('Revenue', colX[1], doc.y - doc.currentLineHeight());
    doc.text('Cost', colX[2], doc.y - doc.currentLineHeight());
    doc.text('Profit', colX[3], doc.y - doc.currentLineHeight());
    doc.text('Margin %', colX[4], doc.y - doc.currentLineHeight());
    doc.moveDown(0.3);
    for (const row of monthlyTrend) {
      const y = doc.y;
      doc.text(String(row.month).slice(0, 10), colX[0], y);
      doc.text(fmt(row.total_revenue), colX[1], y);
      doc.text(fmt(row.total_cost), colX[2], y);
      doc.text(fmt(row.total_profit), colX[3], y);
      doc.text(row.avg_margin_pct !== null ? `${Number(row.avg_margin_pct).toFixed(1)}%` : 'N/A', colX[4], y);
      doc.moveDown(0.7);
    }
    doc.end();
  });
}

function fmt(value) {
  return (Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

module.exports = { buildSurgeriesExcel, buildSurgeriesCsv, buildDashboardPdf };
