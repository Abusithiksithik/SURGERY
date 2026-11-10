'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
test('OT Item Master migration is additive and includes requested fields and categories',()=>{
 const sql=fs.readFileSync(path.join(root,'database/split/33_ot_item_master_fields.sql'),'utf8');
 for(const col of ['storage','fixed_qty_in_ot','default_source','is_controlled_high_alert','remarks','added_on']) assert.match(sql,new RegExp(`ADD COLUMN IF NOT EXISTS ${col}`));
 assert.match(sql,/INJECTABLE_DRUG/);assert.match(sql,/ANAESTHESIA_AGENT_CONSUMABLE/);assert.match(sql,/SURGICAL_DISPOSABLE/);
 const init=fs.readFileSync(path.join(root,'src/db/initializeDatabase.js'),'utf8');assert.match(init,/2\[7-9\]\|3\[0-9\]/);assert.match(init,/readdirSync/);
});
