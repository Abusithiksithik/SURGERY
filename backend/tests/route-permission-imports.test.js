'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routesRoot = path.join(__dirname, '..', 'src', 'modules');

function collectRouteFiles(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) collectRouteFiles(fullPath, output);
    else if (entry.isFile() && entry.name.endsWith('.routes.js')) output.push(fullPath);
  }
  return output;
}

test('every route using requirePermission imports or defines it', () => {
  const offenders = [];
  for (const file of collectRouteFiles(routesRoot)) {
    const source = fs.readFileSync(file, 'utf8');
    if (!/\brequirePermission\s*\(/.test(source)) continue;
    const imported = /(?:const|let|var)\s*\{[^}]*\brequirePermission\b[^}]*\}\s*=\s*require\(/s.test(source);
    const defined = /(?:const|let|var)\s+requirePermission\s*=/.test(source) || /function\s+requirePermission\s*\(/.test(source);
    if (!imported && !defined) offenders.push(path.relative(path.join(__dirname, '..'), file));
  }
  assert.deepEqual(offenders, [], `Missing requirePermission import: ${offenders.join(', ')}`);
});
