'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('OT Add Item dialog exposes the requested item, fixed-stock, tracking and opening-stock fields', () => {
  const ui = read('frontend/src/features/stock/components/OtItemMasterDialog.tsx');
  for (const label of [
    'Item Code (auto)', 'Item Name', 'Generic Name', 'Category', 'Strength / Size', 'Storage',
    'Fixed Qty in OT', 'UOM (base unit)', 'Pack Size (units per pack)', 'Purchase Rate (₹)',
    'Default Source', 'Track Batch', 'Track Expiry', 'Track Serial', 'Controlled / High-alert',
    'Is Billable', 'Qty in OT now', 'Batch No', 'Expiry Date', 'Status', 'Added On', 'Remarks',
  ]) assert.ok(ui.includes(label), `Missing UI field: ${label}`);
  for (const uom of ['NOS','AMP','VIAL','BTL','BAG','PAIR','PKT','BOX','SET','KIT','ROLL','TUBE','STRIP','TAB','ML']) {
    assert.ok(ui.includes(`'${uom}'`), `Missing UOM option ${uom}`);
  }
});

test('OT Add Item is launched from Receive Stock and newly created item is selected for receipt', () => {
  const page = read('frontend/src/features/stock/StockStorePage.tsx');
  assert.match(page, /setAddItemOpen\(true\)/);
  assert.match(page, /<OtItemMasterDialog/);
  assert.match(page, /itemId\s*\}\]\)/);
});

test('Item create records optional opening stock in append-only ledger and fixed target in OT dashboard', () => {
  const service = read('backend/src/modules/masters/sprint1.service.js');
  assert.match(service, /INSERT INTO stock_ledger[\s\S]*?'OPENING'/);
  assert.match(service, /randomUUID\(\)/);
  assert.match(service, /INSERT INTO ot_fixed_stock_targets[\s\S]*ON CONFLICT \(item_id,location_id\)/);
  assert.match(service, /opening_qty/);
});

test('Item API validates the OT item categories and opening stock fields', () => {
  const routes = read('backend/src/modules/masters/sprint1.routes.js');
  for (const category of ['INJECTABLE_DRUG','IV_FLUID','SUTURE','IMPLANT_STENT_MESH','CATHETER_TUBE_SET','SYRINGE_NEEDLE_CANNULA','GLOVES','ANTISEPTIC_SOLUTION','DRESSING_PLASTER_TAPE','LINEN_DRAPE','ANAESTHESIA_AGENT_CONSUMABLE','SURGICAL_DISPOSABLE','OTHER']) {
    assert.ok(routes.includes(`'${category}'`), `Missing category ${category}`);
  }
  assert.match(routes, /opening_qty:Joi\.number\(\)\.precision\(3\)\.min\(0\)/);
  assert.match(routes, /opening_batch_no:Joi\.string\(\)/);
  assert.match(routes, /opening_expiry_date:Joi\.date\(\)\.iso\(\)/);
});


test('opening stock creates separate batch rows with independent batch and expiry values', () => {
  const ui = read('frontend/src/features/stock/components/OtItemMasterDialog.tsx');
  const service = read('backend/src/modules/masters/sprint1.service.js');
  const routes = read('backend/src/modules/masters/sprint1.routes.js');
  assert.match(ui, /opening_batches:form\.opening_batches\.map/);
  assert.match(ui, /Opening Batch \{index\+1\}/);
  assert.match(ui, /The sum of batch quantities must equal Qty in OT now/);
  assert.match(ui, /form\.opening_batches\.some\(row=>!row\.batch_no\.trim\(\)\)/);
  assert.match(ui, /form\.opening_batches\.some\(row=>!row\.expiry_date\)/);
  assert.match(service, /const openingBatches = Array\.isArray\(data\.opening_batches\)/);
  assert.match(service, /batchTotal - openingQty/);
  assert.match(service, /for \(const row of openingBatches\)/);
  assert.match(service, /row\.batchNumber,row\.expiryDate/);
  assert.match(routes, /opening_batches:Joi\.array\(\)/);
});


test('default vendor is optional for OT items when replacement source does not require a selected vendor', () => {
  const routes = read('backend/src/modules/masters/sprint1.routes.js');
  assert.match(routes, /const optionalVendorId=Joi\.string\(\)\.uuid\(\)\.allow\(null\)\.optional\(\)/);
  assert.match(routes, /default_vendor_id:optionalVendorId/);
  assert.doesNotMatch(routes, /default_vendor_id:id\.allow\(null\)/);
});
