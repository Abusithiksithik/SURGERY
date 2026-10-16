'use strict';

// Re-runnable item-master importer. It deliberately does not import opening stock.
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { query, queryOne, disconnectPool } = require('../src/config/db');

const REVIEW_TERMS = [
  'Ceftriazone','Feusemide','Frusemide','Dyclofenac','Metaprolol','Veccuronium','Pentazocaine','Sulbactum',
  'Surgical Blade 15Surgeon','PRolene','EPIdural','Romson','Romsons','Spinal Needle 26 Quinke',
  'Betadine Solution (ml) PLACEHOLDER','Bedsheet'
];
const normalize = (v) => String(v ?? '').trim().replace(/\s+/g,' ');
const keyOf = (v) => normalize(v).toLocaleLowerCase('en-US');
function categoryFor(header,name) {
 const h=String(header||'').toLowerCase(); const n=String(name||'').toLowerCase();
 if(h.includes('suture'))return 'SUTURE';
 if(h.includes('implant'))return 'IMPLANT';
 if(h.includes('returnable')||h.includes('linen')||n.includes('bedsheet'))return 'LINEN_RETURNABLE';
 if(h.includes('non billed')||h.includes('non-billed'))return 'NON_BILLED';
 if(/glove|mask|cap|gown|ppe/.test(n))return 'PPE';
 if(h.includes('billable')&&(/\binj\b|infusion|injection|tablet|capsule|solution/.test(n)))return 'MEDICINE';
 if(h.includes('billable'))return 'CONSUMABLE';
 return 'CONSUMABLE';
}
function itemCode(name) { return `OT-${crypto.createHash('sha1').update(keyOf(name)).digest('hex').slice(0,12).toUpperCase()}`; }
function collectRows(workbook) {
 const ws=workbook.getWorksheet('Masters'); if(!ws)throw new Error('Workbook must contain a "Masters" worksheet.');
 const specs=new Map(); const specWs=workbook.getWorksheet('Suture Specifications');
 if(specWs){
  const headers=[]; for(let c=1;c<=specWs.columnCount;c++)headers[c]=keyOf(specWs.getRow(1).getCell(c).text||specWs.getRow(1).getCell(c).value);
  const findCol=(...names)=>headers.findIndex(h=>names.includes(h));
  const nameCol=Math.max(1,findCol('display name','displayname') );
  const columns={brand:findCol('brand line','suture brand line','brand'),size:findCol('size','suture size'),needleMm:findCol('needle mm','needle (mm)','needle diameter mm'),needleCode:findCol('needle code','code'),lengthCm:findCol('length cm','length (cm)'),material:findCol('material'),absorbable:findCol('absorbable')};
  for(let r=2;r<=specWs.rowCount;r++){const row=specWs.getRow(r);const name=normalize(row.getCell(nameCol).text||row.getCell(nameCol).value);if(name){const info={};for(const [key,col] of Object.entries(columns)){if(col>0){const value=row.getCell(col).value;if(value!==null&&value!==undefined&&String(value).trim()!=='')info[key]=key==='absorbable'?/^(true|yes|y|1)$/i.test(String(value)):key==='needleMm'||key==='lengthCm'?Number(value):String(value).trim();}}specs.set(keyOf(name),info);}}
 }
 const rows=[]; const first=ws.getRow(1);
 // Workbook snapshot uses category columns on the Masters sheet. Each populated cell below a category header is one master value.
 for(let col=1;col<=ws.columnCount;col++){
  const header=normalize(first.getCell(col).text||first.getCell(col).value); if(!header)continue;
  for(let r=2;r<=ws.rowCount;r++){
   const value=normalize(ws.getRow(r).getCell(col).text||ws.getRow(r).getCell(col).value); if(!value)continue;
   if(['item','item name','name','display name','masters'].includes(keyOf(value)))continue;
   const category=categoryFor(header,value);
   const needsReview=REVIEW_TERMS.some(term=>keyOf(value).includes(keyOf(term))) || /^\s|\s{2,}/.test(String(ws.getRow(r).getCell(col).text||ws.getRow(r).getCell(col).value));
   rows.push({sourceRow:r,sourceColumn:col,header,name:value,normalized:normalize(value),category,isBillable:!['NON_BILLED','LINEN_RETURNABLE'].includes(category),needsReview,sutureSpec:specs.get(keyOf(value))||{}});
  }
 }
 return rows;
}
async function main(){
 const args=process.argv.slice(2); const file=args.find(a=>!a.startsWith('--')); const dryRun=args.includes('--dry-run');
 if(!file){console.error('Usage: npm run import:items -- <file.xlsx> [--dry-run]');process.exitCode=2;return;}
 const full=path.resolve(file); const workbook=new ExcelJS.Workbook(); await workbook.xlsx.readFile(full);
 const sourceRows=collectRows(workbook); const seen=new Map(); const newItems=[]; const duplicates=[]; const review=[];
 const existingRows=await query('SELECT item_id,item_name FROM consumable_items'); const existing=new Set(existingRows.rows.map(r=>keyOf(r.item_name)));
 for(const item of sourceRows){const key=keyOf(item.name);if(seen.has(key)||existing.has(key)){duplicates.push(item);continue;}seen.set(key,item);if(item.needsReview)review.push(item);else newItems.push(item);}
 console.log('\nNEW ITEMS');newItems.forEach(x=>console.log(`row ${x.sourceRow} [${x.header}] ${x.normalized} -> ${x.category}`));
 console.log('\nEXACT DUPLICATES');duplicates.forEach(x=>console.log(`row ${x.sourceRow} ${x.name}`));
 console.log('\nNEEDS REVIEW (human decision required)');review.forEach(x=>console.log(`row ${x.sourceRow} [${x.header}] ${x.name}`));
 console.log(`\nSummary: ${newItems.length} new, ${duplicates.length} exact duplicates, ${review.length} needs review. Dry run: ${dryRun?'yes':'no'}.`);
 if(dryRun)return;
 let inserted=0, skipped=0;
 for(const item of [...newItems,...review]){
  const name=item.normalized; const exists=await queryOne('SELECT item_id FROM consumable_items WHERE lower(regexp_replace(trim(item_name),\'[[:space:]]+\',\' \',\'g\'))=$1',[keyOf(name)]);
  if(exists){skipped++;await query(`INSERT INTO item_import_log(source_file,source_row,item_name,action,message) VALUES($1,$2,$3,'DUPLICATE','Already exists; skipped')`,[path.basename(full),item.sourceRow,name]);continue;}
  const category=item.category; const code=itemCode(name);
  const isImplant=category==='IMPLANT';
  const spec=item.sutureSpec||{}; const hydrogen=/hydrogen peroxide\s*\(ml\)/i.test(name);
  await query(`INSERT INTO consumable_items(item_code,item_name,unit,category,is_billable,generic_name,brand,suture_brand_line,suture_size,needle_mm,needle_code,length_cm,material,absorbable,uom,pack_size,pack_uom,track_batch,track_expiry,track_serial,purchase_rate,is_active)
    VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NULL,TRUE)`,[
      code,name,category,item.isBillable,null,spec.brand||null,spec.brand||null,spec.size||null,spec.needleMm||null,spec.needleCode||null,spec.lengthCm||null,spec.material||null,spec.absorbable??null,
      hydrogen?'ml':null,hydrogen?500:null,hydrogen?'ml':null,isImplant,isImplant,isImplant
    ]);
  inserted++;await query(`INSERT INTO item_import_log(source_file,source_row,item_name,action,message) VALUES($1,$2,$3,'INSERT',$4)`,[path.basename(full),item.sourceRow,name,item.needsReview?'Imported but flagged for human review':'Imported']);
 }
 for(const item of duplicates)await query(`INSERT INTO item_import_log(source_file,source_row,item_name,action,message) VALUES($1,$2,$3,'DUPLICATE','Duplicate in workbook or existing master; skipped')`,[path.basename(full),item.sourceRow,item.normalized]);
 console.log(`\nImport complete: ${inserted} inserted, ${skipped+duplicates.length} skipped. Opening stock was not imported.`);
}
main().catch(err=>{console.error(`Item import failed: ${err.message}`);process.exitCode=1;}).finally(async()=>{await disconnectPool().catch(()=>{});});
