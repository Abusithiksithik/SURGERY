'use strict';

/**
 * Wraps an async Express route handler so any rejected promise is
 * forwarded to next(err) automatically, instead of every controller
 * needing its own try/catch.
 *
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
