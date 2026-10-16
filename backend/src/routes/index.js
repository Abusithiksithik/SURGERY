'use strict';

const express = require('express');

const router = express.Router();

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/masters', require('../modules/masters/masters.routes'));
router.use('/surgeries', require('../modules/surgeries/surgeries.routes'));
router.use('/scheduling', require('../modules/scheduling/scheduling.routes'));
router.use('/recommendations', require('../modules/recommendations/recommendations.routes'));
router.use('/explorer', require('../modules/explorer/explorer.routes'));
router.use('/benchmarks', require('../modules/benchmarks/benchmarks.routes'));
router.use('/dashboard', require('../modules/dashboard/dashboard.routes'));
router.use('/alerts', require('../modules/alerts/alerts.routes'));
router.use('/reports', require('../modules/reports/reports.routes'));
router.use('/preop', require('../modules/preop/preop.routes'));
router.use('/documents', require('../modules/documents/documents.routes'));
router.use('/actuals', require('../modules/actuals/actuals.routes'));
router.use('/audit', require('../modules/audit/audit.routes'));
router.use('/permissions', require('../modules/permissions/permissions.routes'));

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
