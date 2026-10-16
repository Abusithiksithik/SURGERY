'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Sprint 0/Sprint 1 SQL migrations 18 through 26 are registered and present',()=>{
 const init=fs.readFileSync(path.join(root,'src/db/initializeDatabase.js'),'utf8');
 for(let n=18;n<=26;n++){
  const file=`${String(n).padStart(2,'0')}_`;
  const registered=init.includes(`'${file}`)||init.includes(`'${file}`.replaceAll("'",'"'));
  const present=fs.readdirSync(path.join(root,'database/split')).some(name=>name.startsWith(file)&&name.endsWith('.sql'));
  assert.ok(present,`migration ${n} exists`);
  assert.ok(registered,`migration ${n} is registered in SCHEMA_FILES`);
 }
});
test('production validation and admin password logging fix are present',()=>{
 const env=fs.readFileSync(path.join(root,'src/config/env.js'),'utf8');
 assert.match(env,/at least 32 characters/);assert.match(env,/default password/);assert.match(env,/default database password/);
 const init=fs.readFileSync(path.join(root,'src/db/initializeDatabase.js'),'utf8');
 assert.doesNotMatch(init,/login: \$\{env\.ADMIN_USERNAME\} \/ \$\{env\.ADMIN_PASSWORD\}/);
});

test('professional migration supports legacy databases without anaesthetist qualification',()=>{
 const migration=fs.readFileSync(path.join(root,'database/split/19_professional_master.sql'),'utf8');
 assert.match(migration,/ALTER TABLE anaesthetists ADD COLUMN IF NOT EXISTS qualification VARCHAR\(120\)/);
 assert.ok(migration.indexOf('ALTER TABLE anaesthetists ADD COLUMN IF NOT EXISTS qualification') < migration.indexOf('INSERT INTO staff'));
});
test('seed uses actual department IDs when the Node fallback already seeded GEN',()=>{
 const seed=fs.readFileSync(path.join(root,'database/split/06_seed.sql'),'utf8');
 assert.match(seed,/SELECT department_id INTO dep1 FROM departments WHERE branch_id=bid AND department_code='GEN'/);
 assert.match(seed,/SELECT department_id INTO dep2 FROM departments WHERE branch_id=bid AND department_code='ORTHO'/);
 assert.match(seed,/SELECT department_id INTO dep3 FROM departments WHERE branch_id=bid AND department_code='CARDIO'/);
 assert.match(seed,/department_code='ORTHO' LIMIT 1/);
 assert.match(seed,/department_code='CARDIO' LIMIT 1/);
});

test('SQL seed never creates an admin with a hardcoded default password',()=>{
 const seed=fs.readFileSync(path.join(root,'database/split/06_seed.sql'),'utf8');
 assert.doesNotMatch(seed,/Admin@12345|crypt\('Admin@12345'/);
 const init=fs.readFileSync(path.join(root,'src/db/initializeDatabase.js'),'utf8');
 assert.ok(init.includes('await client.query(readSql(SEED_FILE));'));
 assert.ok(init.includes('Initialize admin credentials from environment; never seed a hardcoded default password.'));
 assert.ok(init.includes('await nodejsSeed(client);'));
});

test('item master migration adds updated_at for legacy consumable_items schemas',()=>{
 const migration=fs.readFileSync(path.join(root,'database/split/22_item_master.sql'),'utf8');
 assert.match(migration,/ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP\(3\) NOT NULL DEFAULT now\(\)/);
 assert.ok(migration.indexOf('ADD COLUMN IF NOT EXISTS updated_at') < migration.indexOf('UPDATE consumable_items SET item_name'));
});
