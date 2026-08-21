'use strict';

/**
 * preop.service.js
 * Raw SQL (no ORM) service for Pre-Op Checklist Templates (Parent) and
 * Checklist Items (Child).
 *
 * Parent: preop_checklist_templates  (template_id, procedure_id, is_active)
 * Child : preop_checklist_items      (item_id, template_id, checklist_item, sort_order)
 */

const { query, queryOne, queryRows } = require('../../config/db');
const ApiError = require('../../utils/ApiError');

// ─── helpers ─────────────────────────────────────────────────────────────────

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toObj(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}

// ─── Templates (Parent) ──────────────────────────────────────────────────────

/**
 * List all templates, each enriched with:
 *   - procedure name (from surgery_types)
 *   - child items ordered by sort_order
 */
async function listTemplates() {
  const rows = await queryRows(`
    SELECT
      t.template_id,
      t.procedure_id,
      t.is_active,
      t.created_at,
      t.updated_at,
      st.name  AS procedure_name,
      st.code  AS procedure_code
    FROM preop_checklist_templates t
    JOIN surgery_types st ON st.surgery_type_id = t.procedure_id
    ORDER BY st.name, t.created_at
  `, []);

  const templates = rows.map(toObj);

  // Attach child items to each template
  if (templates.length === 0) return templates;

  const templateIds = templates.map((t) => t.templateId);
  const placeholders = templateIds.map((_, i) => `$${i + 1}`).join(', ');
  const items = await queryRows(`
    SELECT item_id, template_id, checklist_item, sort_order
    FROM   preop_checklist_items
    WHERE  template_id IN (${placeholders})
    ORDER  BY template_id, sort_order
  `, templateIds);

  const itemsByTemplate = {};
  for (const item of items) {
    const tid = item.template_id;
    if (!itemsByTemplate[tid]) itemsByTemplate[tid] = [];
    itemsByTemplate[tid].push(toObj(item));
  }

  return templates.map((t) => ({
    ...t,
    items: itemsByTemplate[t.templateId] ?? [],
  }));
}

/**
 * Get one template by ID with its child items.
 */
async function getTemplateById(templateId) {
  const row = await queryOne(
    `SELECT t.template_id, t.procedure_id, t.is_active, t.created_at, t.updated_at,
            st.name AS procedure_name, st.code AS procedure_code
     FROM   preop_checklist_templates t
     JOIN   surgery_types st ON st.surgery_type_id = t.procedure_id
     WHERE  t.template_id = $1`,
    [templateId]
  );
  if (!row) throw ApiError.notFound('Template not found');
  const template = toObj(row);

  const itemRows = await queryRows(
    `SELECT item_id, template_id, checklist_item, sort_order
     FROM   preop_checklist_items
     WHERE  template_id = $1
     ORDER  BY sort_order`,
    [templateId]
  );
  template.items = itemRows.map(toObj);
  return template;
}

/**
 * Create a new template (parent only). Items are saved separately.
 */
async function createTemplate({ procedureId, isActive = true }) {
  if (!procedureId) throw ApiError.badRequest('procedureId is required');

  // Check procedure exists
  const proc = await queryOne(
    'SELECT surgery_type_id, name FROM surgery_types WHERE surgery_type_id = $1',
    [procedureId]
  );
  if (!proc) throw ApiError.badRequest('Procedure not found');

  // Option A: block duplicate active templates for same procedure
  if (isActive) {
    const existing = await queryOne(
      `SELECT template_id FROM preop_checklist_templates
       WHERE procedure_id = $1 AND is_active = true`,
      [procedureId]
    );
    if (existing) {
      throw ApiError.badRequest(
        `An active checklist template already exists for "${proc.name}". ` +
        `Deactivate or edit the existing template instead of creating a new one.`
      );
    }
  }

  const { rows } = await query(
    `INSERT INTO preop_checklist_templates (procedure_id, is_active)
     VALUES ($1, $2)
     RETURNING *`,
    [procedureId, isActive]
  );
  return toObj(rows[0]);
}

/**
 * Update a template's procedure_id and/or is_active.
 * Also replaces child items if provided.
 */
async function updateTemplate(templateId, { procedureId, isActive, items }) {
  await getTemplateById(templateId); // 404 guard

  const updates = [];
  const params  = [];

  if (procedureId !== undefined) {
    params.push(procedureId);
    updates.push(`procedure_id = $${params.length}`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    updates.push(`is_active = $${params.length}`);
  }
  if (updates.length > 0) {
    params.push(templateId);
    await query(
      `UPDATE preop_checklist_templates
          SET ${updates.join(', ')}, updated_at = now()
        WHERE template_id = $${params.length}`,
      params
    );
  }

  // Replace all child items if provided
  if (Array.isArray(items)) {
    await replaceItems(templateId, items);
  }

  return getTemplateById(templateId);
}

/**
 * Activate / deactivate a template.
 */
async function setTemplateActive(templateId, isActive) {
  const template = await getTemplateById(templateId);

  // When ACTIVATING, check no other template is already active for this procedure
  if (isActive) {
    const conflict = await queryOne(
      `SELECT template_id FROM preop_checklist_templates
       WHERE procedure_id = $1 AND is_active = true AND template_id <> $2`,
      [template.procedureId, templateId]
    );
    if (conflict) {
      throw ApiError.badRequest(
        `Another active template already exists for "${template.procedureName || 'this procedure'}". ` +
        `Deactivate it first before activating this one.`
      );
    }
  }

  const { rows } = await query(
    `UPDATE preop_checklist_templates
        SET is_active = $1, updated_at = now()
      WHERE template_id = $2
     RETURNING *`,
    [isActive, templateId]
  );
  return toObj(rows[0]);
}

// ─── Items (Child) ────────────────────────────────────────────────────────────

/**
 * Replace ALL items for a template in one atomic operation.
 * Deletes existing rows first, then re-inserts ordered by provided list.
 */
async function replaceItems(templateId, items) {
  // Ensure template exists
  await queryOne(
    'SELECT template_id FROM preop_checklist_templates WHERE template_id = $1',
    [templateId]
  );

  await query(
    'DELETE FROM preop_checklist_items WHERE template_id = $1',
    [templateId]
  );

  if (!items || items.length === 0) return [];

  const inserted = [];
  for (let i = 0; i < items.length; i++) {
    const { checklistItem } = items[i];
    if (!checklistItem || !checklistItem.trim()) continue;
    const { rows } = await query(
      `INSERT INTO preop_checklist_items (template_id, checklist_item, sort_order)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [templateId, checklistItem.trim(), i + 1]
    );
    inserted.push(toObj(rows[0]));
  }
  return inserted;
}

// ─── Pre-Op Checklist fetch for a Surgery ────────────────────────────────────

/**
 * Given a surgery_id:
 *   1. Look up its surgery_type_id (procedure)
 *   2. Find the active checklist template for that procedure
 *   3. Return template + items ordered by sort_order
 *
 * Returns null if no active template found for the procedure.
 */
async function getChecklistForSurgery(surgeryId) {
  // Step 1: get the surgery's procedure
  const surgery = await queryOne(
    `SELECT surgery_id, surgery_type_id, status
     FROM   surgeries
     WHERE  surgery_id = $1`,
    [surgeryId]
  );
  if (!surgery) throw ApiError.notFound('Surgery not found');

  const procedureId = surgery.surgery_type_id;

  // Step 2: find active template for this procedure
  const template = await queryOne(
    `SELECT t.template_id, t.procedure_id, t.is_active,
            st.name AS procedure_name, st.code AS procedure_code
     FROM   preop_checklist_templates t
     JOIN   surgery_types st ON st.surgery_type_id = t.procedure_id
     WHERE  t.procedure_id = $1
       AND  t.is_active = true
     ORDER  BY t.created_at DESC
     LIMIT  1`,
    [procedureId]
  );

  if (!template) {
    return {
      surgeryId: surgery.surgery_id,
      procedureId,
      template: null,
      items: [],
      message: 'No active checklist template found for this procedure.',
    };
  }

  // Step 3: fetch child items ordered by sort_order
  const items = await queryRows(
    `SELECT item_id, template_id, checklist_item, sort_order
     FROM   preop_checklist_items
     WHERE  template_id = $1
     ORDER  BY sort_order`,
    [template.template_id]
  );

  return {
    surgeryId: surgery.surgery_id,
    procedureId,
    template: toObj(template),
    items: items.map(toObj),
  };
}

// ─── Completion: save checked state per surgery ───────────────────────────────

/**
 * Upsert completion status for one or more checklist items for a surgery.
 * Payload: [{ itemId, isChecked }]
 */
async function saveCompletion(surgeryId, completions, userId) {
  // Verify surgery exists
  const surgery = await queryOne(
    'SELECT surgery_id FROM surgeries WHERE surgery_id = $1',
    [surgeryId]
  );
  if (!surgery) throw ApiError.notFound('Surgery not found');

  for (const { itemId, isChecked } of completions) {
    // Verify item exists
    const item = await queryOne(
      'SELECT item_id FROM preop_checklist_items WHERE item_id = $1',
      [itemId]
    );
    if (!item) continue; // skip unknown items silently

    await query(
      `INSERT INTO surgery_preop_completions
         (surgery_id, item_id, is_checked, checked_by, checked_at, updated_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $3 THEN now() ELSE NULL END, now())
       ON CONFLICT (surgery_id, item_id) DO UPDATE
         SET is_checked  = EXCLUDED.is_checked,
             checked_by  = EXCLUDED.checked_by,
             checked_at  = EXCLUDED.checked_at,
             updated_at  = now()`,
      [surgeryId, itemId, !!isChecked, userId || null]
    );
  }
  return getCompletionForSurgery(surgeryId);
}

/**
 * Fetch all completion rows for a surgery (keyed by item_id).
 * Returns: { [itemId]: { isChecked, checkedAt, checkedBy } }
 */
async function getCompletionForSurgery(surgeryId) {
  const rows = await queryRows(
    `SELECT c.item_id, c.is_checked, c.checked_at, u.full_name AS checked_by_name
     FROM   surgery_preop_completions c
     LEFT JOIN users u ON u.user_id = c.checked_by
     WHERE  c.surgery_id = $1`,
    [surgeryId]
  );
  const result = {};
  for (const row of rows) {
    result[row.item_id] = {
      isChecked:     row.is_checked,
      checkedAt:     row.checked_at,
      checkedByName: row.checked_by_name,
    };
  }
  return result;
}

// ─── Surgery Checklist (snapshot table) ──────────────────────────────────────

/**
 * Get all surgery_checklist rows for a surgery, enriched with user name.
 */
async function getSurgeryChecklist(surgeryId) {
  const surgery = await queryOne(
    'SELECT surgery_id FROM surgeries WHERE surgery_id = $1', [surgeryId]
  );
  if (!surgery) throw ApiError.notFound('Surgery not found');

  const rows = await queryRows(
    `SELECT sc.checklist_id, sc.surgery_id, sc.template_item_id,
            sc.item_label, sc.sort_order, sc.status,
            sc.completed_at, sc.remarks,
            u.full_name AS completed_by_name,
            sc.created_at, sc.updated_at
     FROM   surgery_checklist sc
     LEFT JOIN users u ON u.user_id = sc.completed_by
     WHERE  sc.surgery_id = $1
     ORDER  BY sc.sort_order`,
    [surgeryId]
  );
  return rows.map(toObj);
}

/**
 * Update a single surgery_checklist item status/remarks.
 * When marking COMPLETED: set completed_by = userId, completed_at = now().
 * When marking PENDING or NOT_APPLICABLE: clear those fields.
 */
async function updateSurgeryChecklistItem(checklistId, { status, remarks }, userId) {
  const existing = await queryOne(
    'SELECT checklist_id FROM surgery_checklist WHERE checklist_id = $1', [checklistId]
  );
  if (!existing) throw ApiError.notFound('Checklist item not found');

  const sets = ['status = $1', 'remarks = $2', 'updated_at = now()'];
  const vals = [status, remarks ?? null];

  if (status === 'COMPLETED') {
    sets.push(`completed_by = $${vals.push(userId || null)}`);
    sets.push(`completed_at = now()`);
  } else {
    sets.push(`completed_by = NULL`);
    sets.push(`completed_at = NULL`);
  }

  vals.push(checklistId);
  const { rows } = await query(
    `UPDATE surgery_checklist SET ${sets.join(', ')} WHERE checklist_id = $${vals.length} RETURNING *`,
    vals
  );
  return toObj(rows[0]);
}

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  setTemplateActive,
  replaceItems,
  getChecklistForSurgery,
  saveCompletion,
  getCompletionForSurgery,
  getSurgeryChecklist,
  updateSurgeryChecklistItem,
};
