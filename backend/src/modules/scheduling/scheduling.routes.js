'use strict';

const express     = require('express');
const router      = express.Router();
const controller  = require('./scheduling.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const rbac        = require('../../middleware/rbac.middleware');
const validate    = require('../../middleware/validate.middleware');
const { ROLE_GROUPS } = require('../../constants/roles');
const {
  idParam, listQuerySchema,
  createSchema, rescheduleSchema, changeOtSchema,
  changeTeamSchema, postponeSchema, cancelSchema,
} = require('./scheduling.validation');

// Anyone authenticated can view; writers need BUDGET_WRITERS role
const READERS = ROLE_GROUPS.ALL;
const WRITERS = ROLE_GROUPS.BUDGET_WRITERS;

// GET  /api/scheduling                    — list schedules (filterable)
// POST /api/scheduling                    — create schedule for a surgery
router.route('/')
  .get(authenticate, rbac(READERS), validate({ query: listQuerySchema }), controller.list)
  .post(authenticate, rbac(WRITERS), validate({ body: createSchema }),     controller.create);

// GET  /api/scheduling/by-surgery/:id     — get schedule by surgery_id
router.get(
  '/by-surgery/:id',
  authenticate,
  rbac(READERS),
  validate({ params: idParam }),
  controller.getBySurgery
);

// GET  /api/scheduling/surgery-history/:id — full history for a surgery_id
router.get(
  '/surgery-history/:id',
  authenticate,
  rbac(READERS),
  validate({ params: idParam }),
  controller.getHistoryBySurgery
);

// GET  /api/scheduling/:id                — get single schedule
router.get(
  '/:id',
  authenticate,
  rbac(READERS),
  validate({ params: idParam }),
  controller.getById
);

// POST /api/scheduling/:id/confirm
router.post(
  '/:id/confirm',
  authenticate,
  rbac(WRITERS),
  validate({ params: idParam }),
  controller.confirm
);

// POST /api/scheduling/:id/reschedule
router.post(
  '/:id/reschedule',
  authenticate,
  rbac(WRITERS),
  validate({ params: idParam, body: rescheduleSchema }),
  controller.reschedule
);

// POST /api/scheduling/:id/change-ot
router.post(
  '/:id/change-ot',
  authenticate,
  rbac(WRITERS),
  validate({ params: idParam, body: changeOtSchema }),
  controller.changeOt
);

// POST /api/scheduling/:id/change-team
router.post(
  '/:id/change-team',
  authenticate,
  rbac(WRITERS),
  validate({ params: idParam, body: changeTeamSchema }),
  controller.changeTeam
);

// POST /api/scheduling/:id/postpone
router.post(
  '/:id/postpone',
  authenticate,
  rbac(WRITERS),
  validate({ params: idParam, body: postponeSchema }),
  controller.postpone
);

// POST /api/scheduling/:id/cancel
router.post(
  '/:id/cancel',
  authenticate,
  rbac(WRITERS),
  validate({ params: idParam, body: cancelSchema }),
  controller.cancel
);

// PATCH /api/scheduling/:id/time-duration — update OT Room, Time and Duration
router.patch(
  '/:id/time-duration',
  authenticate,
  rbac(WRITERS),
  validate({ params: idParam, body: require('./scheduling.validation').timeDurationSchema }),
  controller.updateTimeDuration
);

// GET  /api/scheduling/:id/history
router.get(
  '/:id/history',
  authenticate,
  rbac(READERS),
  validate({ params: idParam }),
  controller.getHistory
);

// DELETE /api/scheduling/:id  — remove a CANCELLED schedule record only
router.delete(
  '/:id',
  authenticate,
  rbac(WRITERS),
  validate({ params: idParam }),
  controller.deleteSchedule
);

module.exports = router;
