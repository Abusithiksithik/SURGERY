'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ROLES, ROLE_GROUPS } = require('../src/constants/roles');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('Management can access budget-writing routes for create/edit/submit/recommendation workflows', () => {
  assert.ok(ROLE_GROUPS.BUDGET_WRITERS.includes(ROLES.MANAGEMENT));
  assert.ok(ROLE_GROUPS.BUDGET_WRITERS.includes(ROLES.ADMIN));
  assert.ok(ROLE_GROUPS.BUDGET_WRITERS.includes(ROLES.FINANCE));
  assert.ok(ROLE_GROUPS.BUDGET_WRITERS.includes(ROLES.OT_COORDINATOR));
});

test('approval is still controlled by per-user APPROVE_BUDGET permission and no-self-approval guard', () => {
  const service = fs.readFileSync(path.join(root, 'src/modules/surgeries/surgeries.service.js'), 'utf8');
  assert.match(service, /assertPermissionForStatus\(userId,\s*'APPROVE_BUDGET'\)/);
  assert.match(service, /assertNotSameActor\(id,\s*newStatus === 'BUDGET_APPROVED' \? 'approve' : 'revise',\s*userId\)/);
  assert.match(service, /The user who submitted this budget cannot/);
});

test('recommendation generation uses the shared budget-writer role group', () => {
  const routes = fs.readFileSync(path.join(root, 'src/modules/recommendations/recommendations.routes.js'), 'utf8');
  assert.match(routes, /rbac\(ROLE_GROUPS\.BUDGET_WRITERS\)/);
});
