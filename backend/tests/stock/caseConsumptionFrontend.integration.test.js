'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
test('S3-2 frontend route is protected by ENTER_CASE_USAGE', () => {
  const app = read('frontend/src/App.tsx');
  assert.match(app, /path="\/ot-store\/consumption"\s+element=\{<ProtectedRoute permissions=\{\['ENTER_CASE_USAGE'\]\}>/);
});
test('S3-2 navigation is permission-gated', () => {
  const nav = read('frontend/src/layout/navConfig.ts');
  assert.match(nav, /label: 'Surgery Consumption'.*path: '\/ot-store\/consumption'.*permission: 'ENTER_CASE_USAGE'/);
});
test('case consumption UI uses case search, issue, return, wastage and pharmacy handover APIs', () => {
  const api = read('frontend/src/api/stockUsage.api.ts');
  for (const endpoint of ['/stock/usage/cases', '/stock/usage/issues', '/return', '/wastage', '/pharmacy-handover']) assert.ok(api.includes(endpoint), `Missing endpoint ${endpoint}`);
  const page = read('frontend/src/features/stock/CaseConsumptionPage.tsx');
  for (const label of ['Find Surgery Case', 'Available OT Store Stock', 'Issued Items', 'Issue Stock', 'Wastage', 'Handover']) assert.ok(page.includes(label), `Missing UI label ${label}`);
});
