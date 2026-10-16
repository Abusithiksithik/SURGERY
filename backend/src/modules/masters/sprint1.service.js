'use strict';
const { query, queryRows, queryOne, withTransaction } = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const RESOURCES = {
 vendors: { table:'vendors', id:'vendor_id', search:['name','vendor_type'], active:true, fields:['name','vendor_type','contact_person','phone','email','address','gstin','remarks','is_active'] },
 instruments: { table:'instruments', id:'instrument_id', search:['name','brand'], active:true, fields:['name','brand','owned_qty','remarks','is_active'] },
 sets: { table:'instrument_sets', id:'set_id', search:['name','specialty'], active:true, fields:['name','specialty','validity_days','set_count','is_active'] },
 assets: { table:'assets', id:'asset_id', search:['asset_code','name','serial_no','location_text'], active:true, fields:['asset_code','name','category','make','model','serial_no','ot_room_id','location_text','purchase_date','purchase_cost','vendor_id','amc_vendor_id','amc_expiry','last_service_date','next_service_due','status','remarks','is_active'] },
 items: { table:'consumable_items', id:'item_id', search:['item_name','item_code','generic_name','brand'], active:true, fields:['item_code','item_name','unit','standard_cost','category','is_billable','generic_name','spec','brand','suture_brand_line','suture_size','needle_mm','needle_code','length_cm','material','absorbable','uom','pack_size','pack_uom','track_batch','track_expiry','track_serial','purchase_rate','reorder_level','min_level','default_vendor_id','order_code','hsn_code','is_active'] },
};
const snakeToCamel = (s) => s.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
function camelRow(row) { return Object.fromEntries(Object.entries(row).map(([k,v])=>[snakeToCamel(k),v])); }
function resource(name) { const r=RESOURCES[name]; if(!r) throw ApiError.notFound('Unknown master resource.'); return r; }
async function list(name, params={}) {
 const r=resource(name); const values=[]; const where=[];
 if(params.active!==undefined && r.active){values.push(params.active==='true'||params.active===true);where.push(`is_active=$${values.length}`)}
 if(name==='items' && params.category){values.push(params.category);where.push(`category=$${values.length}`)}
 if(name==='items' && params.isBillable!==undefined){values.push(params.isBillable==='true'||params.isBillable===true);where.push(`is_billable=$${values.length}`)}
 if(params.search){values.push(`%${String(params.search).slice(0,150)}%`);const i=values.length;where.push(`(${r.search.map(c=>`${c}::text ILIKE $${i}`).join(' OR ')})`)}
 const clause=where.length?`WHERE ${where.join(' AND ')}`:'';
 const rows=await queryRows(`SELECT * FROM ${r.table} ${clause} ORDER BY created_at DESC NULLS LAST LIMIT 500`,values);
 return rows.map(camelRow);
}
async function create(name,data,userId) {
 const r=resource(name); const safe={}; for(const f of r.fields){if(data[f]!==undefined)safe[f]=data[f]}
 if(name==='items') { safe.item_name=String(safe.item_name||'').trim().replace(/\s+/g,' '); if(!safe.item_name)throw ApiError.badRequest('Item name is required.'); const duplicate=await queryOne("SELECT item_id FROM consumable_items WHERE lower(regexp_replace(trim(item_name),'[[:space:]]+',' ','g'))=$1",[safe.item_name.toLowerCase()]); if(duplicate)throw ApiError.conflict('An item with the same normalized name already exists.'); }
 if(name==='vendors') safe.name=String(safe.name||'').trim();
 if(name==='instruments') safe.name=String(safe.name||'').trim();
 if(name==='sets') safe.name=String(safe.name||'').trim();
 const keys=Object.keys(safe); if(!keys.length)throw ApiError.badRequest('No valid fields supplied.');
 if(!keys.includes('created_by') && ['vendors','instruments','sets','assets','items'].includes(name)) { /* created_by is added separately where supported */ }
 const cols=keys.map(k=>k).join(', '), params=keys.map((k)=>safe[k]);
 const {rows}=await query(`INSERT INTO ${r.table}(${cols}${name==='items'?',created_by':',created_by'}) VALUES(${params.map((_,i)=>`$${i+1}`).join(', ')},$${params.length+1}) RETURNING *`,[...params,userId||null]);
 return camelRow(rows[0]);
}
async function update(name,id,data) {
 const r=resource(name); const safe={}; for(const f of r.fields){if(data[f]!==undefined)safe[f]=data[f]}
 if(name==='items' && safe.item_name!==undefined){safe.item_name=String(safe.item_name).trim().replace(/\s+/g,' ');const duplicate=await queryOne("SELECT item_id FROM consumable_items WHERE lower(regexp_replace(trim(item_name),'[[:space:]]+',' ','g'))=$1 AND item_id<>$2",[safe.item_name.toLowerCase(),id]);if(duplicate)throw ApiError.conflict('An item with the same normalized name already exists.');}
 if(!Object.keys(safe).length)throw ApiError.badRequest('No valid fields supplied.');
 const keys=Object.keys(safe); const vals=keys.map(k=>safe[k]);
 const {rows}=await query(`UPDATE ${r.table} SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(', ')},updated_at=now() WHERE ${r.id}=$${keys.length+1} RETURNING *`,[...vals,id]);
 if(!rows[0])throw ApiError.notFound('Record not found.'); return camelRow(rows[0]);
}
async function deactivate(name,id,active=false) { const r=resource(name); const {rows}=await query(`UPDATE ${r.table} SET is_active=$1,updated_at=now() WHERE ${r.id}=$2 RETURNING *`,[active,id]); if(!rows[0])throw ApiError.notFound('Record not found.'); return camelRow(rows[0]); }
async function roomOperations(id,data) {
 const {rows}=await query(`UPDATE ot_rooms SET turnaround_min=COALESCE($1,turnaround_min),ot_status=COALESCE($2,ot_status),location=COALESCE($3,location),updated_at=now() WHERE ot_room_id=$4 RETURNING *`,[data.turnaroundMin??null,data.otStatus??null,data.location??null,id]);
 if(!rows[0])throw ApiError.notFound('OT room not found.'); return camelRow(rows[0]);
}
async function listSetItems(setId) {
 return queryRows(`SELECT isi.set_id,isi.instrument_id,isi.qty,i.name,i.brand FROM instrument_set_items isi JOIN instruments i ON i.instrument_id=isi.instrument_id WHERE isi.set_id=$1 ORDER BY i.name`,[setId]).then(rows=>rows.map(camelRow));
}
async function replaceSetItems(setId,items,userId) {
 return withTransaction(async client=>{
  const set=await client.query('SELECT set_id FROM instrument_sets WHERE set_id=$1',[setId]); if(!set.rows[0])throw ApiError.notFound('Instrument set not found.');
  const seen=new Set(); const resolved=[];
  for(const item of items){const key=String(item.name||'').trim().toLowerCase();if(!key)throw ApiError.badRequest('Each instrument needs a name.');if(seen.has(key))throw ApiError.badRequest(`Duplicate instrument in set: ${item.name}`);seen.add(key);
   let found=await client.query('SELECT instrument_id FROM instruments WHERE lower(trim(name))=$1 LIMIT 1',[key]);
   if(!found.rows[0])found=await client.query('INSERT INTO instruments(name,brand,owned_qty,created_by) VALUES($1,$2,0,$3) RETURNING instrument_id',[String(item.name).trim(),item.brand||null,userId||null]);
   resolved.push({id:found.rows[0].instrument_id,qty:item.qty});
  }
  await client.query('DELETE FROM instrument_set_items WHERE set_id=$1',[setId]);
  for(const item of resolved) await client.query('INSERT INTO instrument_set_items(set_id,instrument_id,qty,created_by) VALUES($1,$2,$3,$4)',[setId,item.id,item.qty,userId||null]);
  return resolved.length;
 });
}
async function setRequirement() { return queryRows('SELECT * FROM v_set_requirement ORDER BY instrument_name').then(rows=>rows.map(camelRow)); }
async function getPreferenceCard(surgeryTypeId) {
 const procedure=await queryOne('SELECT surgery_type_id,name,specialty,indicative_package_amount,typical_ot_type FROM surgery_types WHERE surgery_type_id=$1',[surgeryTypeId]); if(!procedure)throw ApiError.notFound('Procedure not found.');
 const [items,sets]=await Promise.all([
  queryRows(`SELECT ppi.*,ci.item_name,ci.item_code FROM procedure_preference_items ppi JOIN consumable_items ci ON ci.item_id=ppi.item_id WHERE ppi.surgery_type_id=$1 ORDER BY ppi.sort_order,ci.item_name`,[surgeryTypeId]),
  queryRows(`SELECT pds.set_id,iset.name FROM procedure_default_sets pds JOIN instrument_sets iset ON iset.set_id=pds.set_id WHERE pds.surgery_type_id=$1 ORDER BY iset.name`,[surgeryTypeId])
 ]);
 return {procedure:camelRow(procedure),items:items.map(camelRow),sets:sets.map(camelRow)};
}
async function savePreferenceCard(surgeryTypeId,data,userId) {
 return withTransaction(async client=>{
  const exists=await client.query('SELECT surgery_type_id FROM surgery_types WHERE surgery_type_id=$1',[surgeryTypeId]); if(!exists.rows[0])throw ApiError.notFound('Procedure not found.');
  const itemIds=new Set(); for(const it of data.items||[]){if(itemIds.has(it.itemId))throw ApiError.badRequest('Duplicate item in preference card.');itemIds.add(it.itemId);}
  const setIds=new Set(); for(const id of data.setIds||[]){if(setIds.has(id))throw ApiError.badRequest('Duplicate instrument set.');setIds.add(id);}
  await client.query('DELETE FROM procedure_preference_items WHERE surgery_type_id=$1',[surgeryTypeId]);
  await client.query('DELETE FROM procedure_default_sets WHERE surgery_type_id=$1',[surgeryTypeId]);
  for(let i=0;i<(data.items||[]).length;i++){const it=data.items[i];await client.query(`INSERT INTO procedure_preference_items(surgery_type_id,item_id,default_qty,is_optional,sort_order,created_by) VALUES($1,$2,$3,$4,$5,$6)`,[surgeryTypeId,it.itemId,it.defaultQty,it.isOptional??false,it.sortOrder??i,userId||null]);}
  for(const id of data.setIds||[]) await client.query('INSERT INTO procedure_default_sets(surgery_type_id,set_id,created_by) VALUES($1,$2,$3)',[surgeryTypeId,id,userId||null]);
  return {itemCount:(data.items||[]).length,setCount:(data.setIds||[]).length};
 });
}
module.exports={list,create,update,deactivate,roomOperations,listSetItems,replaceSetItems,setRequirement,getPreferenceCard,savePreferenceCard};
