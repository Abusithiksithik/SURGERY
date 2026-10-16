'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const envFile=path.resolve(__dirname,'../src/config/env.js');
function validate(overrides={}){
 const base={PATH:process.env.PATH,NODE_ENV:'production',DATABASE_URL:'postgresql://app:rotated-db-password@localhost:5432/hospital',JWT_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64),ADMIN_PASSWORD:'new-unique-password-2026'};
 const env={...base,...overrides};
 return spawnSync(process.execPath,['-e',`const m=require(${JSON.stringify(envFile)});m.validateEnv();`],{env,encoding:'utf8'});
}
test('production accepts explicit strong secrets and non-default admin password',()=>{const r=validate();assert.equal(r.status,0,r.stderr);});
test('production rejects JWT secret shorter than 32 characters',()=>{const r=validate({JWT_SECRET:'short-secret'});assert.notEqual(r.status,0);assert.match(r.stderr,/at least 32 characters/);});
test('production rejects example JWT secrets',()=>{const r=validate({JWT_REFRESH_SECRET:'example-'+ 'x'.repeat(40)});assert.notEqual(r.status,0);assert.match(r.stderr,/example or development secret/);});
test('production rejects default admin password',()=>{const r=validate({ADMIN_PASSWORD:'Admin@12345'});assert.notEqual(r.status,0);assert.match(r.stderr,/default password/);});
test('production rejects known default database password',()=>{const r=validate({DATABASE_URL:'postgresql://postgres:12345@localhost:5432/hospital'});assert.notEqual(r.status,0);assert.match(r.stderr,/default database password/);});

test('production rejects placeholder admin password',()=>{const r=validate({ADMIN_PASSWORD:'CHANGE_ME_BEFORE_FIRST_START'});assert.notEqual(r.status,0);assert.match(r.stderr,/default password/);});
