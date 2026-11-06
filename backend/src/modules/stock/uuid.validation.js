'use strict';

const Joi = require('joi');

// PostgreSQL UUID columns accept any UUID version bits. Some legacy seeded
// surgery/item/location IDs use a non-v4 version nibble, so validate the
// canonical UUID shape without rejecting those existing database identifiers.
module.exports = Joi.string().pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
