'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const backendRoot = path.resolve(__dirname, '../..');
const projectRoot = path.resolve(backendRoot, '..');
const read = (file) => fs.readFileSync(path.join(backendRoot, file), 'utf8');

test('Item Master requires a base UOM and validates stock item identifiers', () => {
  const routes = read('src/modules/masters/sprint1.routes.js');
  const service = read('src/modules/masters/sprint1.service.js');
  assert.match(routes, /item_code:Joi\.string\(\)\.trim\(\)\.min\(1\)/);
  assert.match(routes, /uom:Joi\.string\(\)\.trim\(\)\.min\(1\)\.max\(30\)\.required\(\)/);
  assert.match(service, /Base unit of measure is required for OT Store/);
  assert.match(service, /An item with this item code already exists/);
});

test('Item Master keeps legacy surgery fields synchronized with inventory fields', () => {
  const service = read('src/modules/masters/sprint1.service.js');
  assert.match(service, /safe\.unit=safe\.uom/);
  assert.match(service, /safe\.standard_cost=safe\.purchase_rate/);
  assert.match(service, /safe\.uom=safe\.unit/);
  assert.match(service, /safe\.purchase_rate=safe\.standard_cost/);
});

test('OT Store receiving picker only returns active items with a base UOM', () => {
  const service = read('src/modules/stock/stockReceiving.service.js');
  assert.match(service, /ci\.is_active = TRUE AND COALESCE\(NULLIF\(ci\.uom, ''\), NULLIF\(ci\.unit, ''\)\) IS NOT NULL/);
});

test('Item Master UI exposes supplier, reorder, and batch/expiry/serial controls', () => {
  const ui = fs.readFileSync(path.join(projectRoot, 'frontend/src/features/admin/Sprint1MastersTabs.tsx'), 'utf8');
  for (const field of ['default_vendor_id', 'reorder_level', 'track_batch', 'track_expiry', 'track_serial']) assert.ok(ui.includes(field), `Missing ${field}`);
});

test('Item Master list does not depend on a possibly missing created_at column',()=>{
 const service = read('src/modules/masters/sprint1.service.js');
 assert.match(service,/name === 'items' \? 'item_name ASC, item_code ASC'/);
});

test('Item Master form blocks browser autofill overlays and requires a category', () => {
  const ui = fs.readFileSync(path.join(projectRoot, 'frontend/src/features/admin/Sprint1MastersTabs.tsx'), 'utf8');
  assert.match(ui, /key:'category',label:'Category',type:'select',required:true,defaultValue:'CONSUMABLE'/);
  assert.match(ui, /autoComplete="off"/);
  assert.match(ui, /autoComplete="new-password"/);
});
