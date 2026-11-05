'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const auditContext = new AsyncLocalStorage();

function runWithAuditUser(userId, callback) {
  return auditContext.run({ userId: userId || null }, callback);
}

function getAuditUserId() {
  return auditContext.getStore()?.userId || null;
}

module.exports = { runWithAuditUser, getAuditUserId };
