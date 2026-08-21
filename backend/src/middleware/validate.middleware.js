'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Validates req.body / req.query / req.params against Joi schemas.
 *
 * Usage:
 *   router.post('/', validate({ body: createSurgerySchema }), controller.create)
 *
 * @param {object} schemas - { body?, query?, params? } Joi schemas
 */
function validate(schemas) {
  return function validateMiddleware(req, res, next) {
    const errors = [];

    for (const key of ['params', 'query', 'body']) {
      const schema = schemas[key];
      if (!schema) continue;

      const { error, value } = schema.validate(req[key], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        errors.push(
          ...error.details.map((d) => ({
            location: key,
            field: d.path.join('.'),
            message: d.message,
          }))
        );
      } else {
        req[key] = value;
      }
    }

    if (errors.length > 0) {
      return next(ApiError.validation('Request validation failed', errors));
    }

    next();
  };
}

module.exports = validate;
