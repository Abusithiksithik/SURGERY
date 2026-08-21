'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Role-based authorization. Must run after `authenticate`.
 * Usage: router.get('/finance-report', authenticate, rbac(ROLE_GROUPS.FINANCE_AND_ABOVE), handler)
 *
 * @param {string[]} allowedRoles
 */
function rbac(allowedRoles) {
  return function rbacMiddleware(req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Role '${req.user.role}' is not permitted to perform this action. Requires one of: ${allowedRoles.join(', ')}`
        )
      );
    }
    next();
  };
}

module.exports = rbac;
