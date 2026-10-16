'use strict';

const { queryOne } = require('../config/db');
const ApiError = require('../utils/ApiError');

// Permission is resolved for every request: a user override always wins over a role grant.
function requirePermission(permissionKey) {
  return async function permissionMiddleware(req, res, next) {
    try {
      if (!req.user) throw ApiError.unauthorized();
      const row = await queryOne(
        `SELECT COALESCE(up.is_granted, rp.is_granted, FALSE) AS allowed
           FROM system_permissions p
           LEFT JOIN system_role_permissions rp
             ON rp.permission_id=p.permission_id AND rp.role_name=$2
           LEFT JOIN user_permissions up
             ON up.permission_id=p.permission_id AND up.user_id=$1
          WHERE p.permission_key=$3 AND p.is_active=TRUE`,
        [req.user.userId, req.user.role, permissionKey]
      );
      const allowed = permissionKey === 'MANAGE_ROLE_PERMISSIONS' && req.user.role === 'ADMIN'
        ? true
        : Boolean(row && row.allowed);
      if (!allowed) throw ApiError.forbidden(`Permission '${permissionKey}' is required.`);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requirePermission };
