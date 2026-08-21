'use strict';

const asyncHandler  = require('../../utils/asyncHandler');
const ApiResponse   = require('../../utils/ApiResponse');
const service       = require('./preop.service');

// ── Templates ─────────────────────────────────────────────────────────────────

const listTemplates = asyncHandler(async (req, res) => {
  const data = await service.listTemplates();
  return new ApiResponse(200, data, 'Checklist templates').send(res);
});

const getTemplateById = asyncHandler(async (req, res) => {
  const data = await service.getTemplateById(req.params.id);
  return new ApiResponse(200, data).send(res);
});

const createTemplate = asyncHandler(async (req, res) => {
  const { procedureId, isActive, items } = req.body;
  const template = await service.createTemplate({ procedureId, isActive });
  if (Array.isArray(items) && items.length > 0) {
    await service.replaceItems(template.templateId, items);
  }
  const full = await service.getTemplateById(template.templateId);
  return new ApiResponse(201, full, 'Template created').send(res);
});

const updateTemplate = asyncHandler(async (req, res) => {
  const { procedureId, isActive, items } = req.body;
  const data = await service.updateTemplate(req.params.id, { procedureId, isActive, items });
  return new ApiResponse(200, data, 'Template updated').send(res);
});

const activateTemplate = asyncHandler(async (req, res) => {
  const data = await service.setTemplateActive(req.params.id, true);
  return new ApiResponse(200, data, 'Template activated').send(res);
});

const deactivateTemplate = asyncHandler(async (req, res) => {
  const data = await service.setTemplateActive(req.params.id, false);
  return new ApiResponse(200, data, 'Template deactivated').send(res);
});

// ── Items (replace all for a template) ───────────────────────────────────────

const replaceItems = asyncHandler(async (req, res) => {
  const items = await service.replaceItems(req.params.id, req.body.items ?? []);
  return new ApiResponse(200, items, 'Items saved').send(res);
});

// ── Pre-Op Checklist for a scheduled Surgery ─────────────────────────────────

const getChecklistForSurgery = asyncHandler(async (req, res) => {
  const data = await service.getChecklistForSurgery(req.params.surgeryId);
  return new ApiResponse(200, data).send(res);
});

// ── Completion (per surgery) ──────────────────────────────────────────────────

const getCompletionForSurgery = asyncHandler(async (req, res) => {
  const data = await service.getCompletionForSurgery(req.params.surgeryId);
  return new ApiResponse(200, data).send(res);
});

const saveCompletion = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || null;
  const { completions } = req.body; // [{ itemId, isChecked }]
  if (!Array.isArray(completions)) {
    throw new (require('../../utils/ApiError'))(400, 'completions array is required');
  }
  const data = await service.saveCompletion(req.params.surgeryId, completions, userId);
  return new ApiResponse(200, data, 'Completion saved').send(res);
});

// ── Surgery Checklist (snapshot) ─────────────────────────────────────────────

const getSurgeryChecklist = asyncHandler(async (req, res) => {
  const data = await service.getSurgeryChecklist(req.params.surgeryId);
  return new ApiResponse(200, data).send(res);
});

const updateSurgeryChecklistItem = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || null;
  const { status, remarks } = req.body;
  const data = await service.updateSurgeryChecklistItem(req.params.checklistId, { status, remarks }, userId);
  return new ApiResponse(200, data, 'Checklist item updated').send(res);
});


// ── Surgery Checklist seed (retroactive) ─────────────────────────────────────

/**
 * POST /preop/surgery/:surgeryId/checklist/seed
 * Retroactively seed surgery_checklist for an already-confirmed surgery.
 * Idempotent — ON CONFLICT DO NOTHING inside autoCreateChecklist.
 */
const seedSurgeryChecklist = asyncHandler(async (req, res) => {
  const { surgeryId } = req.params;
  const { autoCreateChecklist } = require('../scheduling/scheduling.service');
  await autoCreateChecklist(surgeryId, null);
  const data = await service.getSurgeryChecklist(surgeryId);
  return new ApiResponse(200, data, 'Checklist seeded').send(res);
});

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  activateTemplate,
  deactivateTemplate,
  replaceItems,
  getChecklistForSurgery,
  getCompletionForSurgery,
  saveCompletion,
  getSurgeryChecklist,
  updateSurgeryChecklistItem,
  seedSurgeryChecklist,
};
