'use strict';

const express   = require('express');
const ctrl      = require('./preop.controller');
const validate  = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const rbac      = require('../../middleware/rbac.middleware');
const { ROLE_GROUPS } = require('../../constants/roles');
const {
  idParamSchema,
  surgeryIdParamSchema,
  createTemplateSchema,
  updateTemplateSchema,
  replaceItemsSchema,
} = require('./preop.validation');

const router = express.Router();

// ── Checklist Templates (Master Config) ──────────────────────────────────────

// GET  /preop/templates                  → list all templates (with items)
router.get(
  '/templates',
  authenticate,
  ctrl.listTemplates
);

// GET  /preop/templates/:id              → get one template + items
router.get(
  '/templates/:id',
  authenticate,
  validate({ params: idParamSchema }),
  ctrl.getTemplateById
);

// POST /preop/templates                  → create template (+ optional items)
router.post(
  '/templates',
  authenticate,
  rbac(ROLE_GROUPS.ADMIN_ONLY),
  validate({ body: createTemplateSchema }),
  ctrl.createTemplate
);

// PUT  /preop/templates/:id              → update template (+ replace items)
router.put(
  '/templates/:id',
  authenticate,
  rbac(ROLE_GROUPS.ADMIN_ONLY),
  validate({ params: idParamSchema, body: updateTemplateSchema }),
  ctrl.updateTemplate
);

// PATCH /preop/templates/:id/activate
router.patch(
  '/templates/:id/activate',
  authenticate,
  rbac(ROLE_GROUPS.ADMIN_ONLY),
  validate({ params: idParamSchema }),
  ctrl.activateTemplate
);

// PATCH /preop/templates/:id/deactivate
router.patch(
  '/templates/:id/deactivate',
  authenticate,
  rbac(ROLE_GROUPS.ADMIN_ONLY),
  validate({ params: idParamSchema }),
  ctrl.deactivateTemplate
);

// PUT  /preop/templates/:id/items        → replace all items for a template
router.put(
  '/templates/:id/items',
  authenticate,
  rbac(ROLE_GROUPS.ADMIN_ONLY),
  validate({ params: idParamSchema, body: replaceItemsSchema }),
  ctrl.replaceItems
);

// ── Surgery-level checklist fetch ─────────────────────────────────────────────

// GET  /preop/surgery/:surgeryId         → fetch checklist for a scheduled surgery
router.get(
  '/surgery/:surgeryId',
  authenticate,
  validate({ params: surgeryIdParamSchema }),
  ctrl.getChecklistForSurgery
);

// ── Surgery-level completion (checked items) ──────────────────────────────────

// GET  /preop/surgery/:surgeryId/completion  → fetch saved completion state
router.get(
  '/surgery/:surgeryId/completion',
  authenticate,
  validate({ params: surgeryIdParamSchema }),
  ctrl.getCompletionForSurgery
);

// POST /preop/surgery/:surgeryId/completion  → save/upsert completion state
router.post(
  '/surgery/:surgeryId/completion',
  authenticate,
  validate({ params: surgeryIdParamSchema }),
  ctrl.saveCompletion
);

// ── Surgery Checklist snapshot (auto-created on scheduling) ──────────────────

// GET  /preop/surgery/:surgeryId/checklist      → list snapshot checklist items
router.get(
  '/surgery/:surgeryId/checklist',
  authenticate,
  validate({ params: surgeryIdParamSchema }),
  ctrl.getSurgeryChecklist
);

// POST /preop/surgery/:surgeryId/checklist/seed → retroactively seed checklist
router.post(
  '/surgery/:surgeryId/checklist/seed',
  authenticate,
  validate({ params: surgeryIdParamSchema }),
  ctrl.seedSurgeryChecklist
);

// PATCH /preop/checklist/:checklistId           -> update a single checklist item
router.patch(
  '/checklist/:checklistId',
  authenticate,
  (req, res, next) => {
    const Joi = require('joi');
    const schema = Joi.object({
      status: Joi.string().valid('PENDING', 'COMPLETED', 'NOT_APPLICABLE').required(),
      remarks: Joi.string().allow('', null).optional(),
    });
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });
    next();
  },
  ctrl.updateSurgeryChecklistItem
);

module.exports = router;
