'use strict';

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  FINANCE: 'FINANCE',
  MANAGEMENT: 'MANAGEMENT',
  SURGEON: 'SURGEON',
  OT_COORDINATOR: 'OT_COORDINATOR',
  VIEWER: 'VIEWER',
});

/**
 * Convenience role groups used by route-level rbac() calls, matching
 * the spec's "Finance only" / "Management only" access requirements.
 */
const ROLE_GROUPS = Object.freeze({
  ALL: Object.values(ROLES),
  FINANCE_AND_ABOVE: [ROLES.ADMIN, ROLES.FINANCE],
  MANAGEMENT_AND_ABOVE: [ROLES.ADMIN, ROLES.MANAGEMENT],
  BUDGET_WRITERS: [ROLES.ADMIN, ROLES.FINANCE, ROLES.OT_COORDINATOR],
  ADMIN_ONLY: [ROLES.ADMIN],
});

module.exports = { ROLES, ROLE_GROUPS };
