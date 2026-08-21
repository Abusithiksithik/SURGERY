-- =====================================================================
-- 11_preop_checklist.sql
-- Module 4 — Pre-Op Checklist Template (Parent + Child)
-- Fully idempotent. Safe to run multiple times.
-- =====================================================================

-- ── 1. Parent: preop_checklist_templates ─────────────────────────────
--    One template per procedure (surgery_type).
--    Only Active templates are used for new surgeries.
CREATE TABLE IF NOT EXISTS preop_checklist_templates (
  template_id   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_id  UUID        NOT NULL,          -- FK → surgery_types.surgery_type_id
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- ── 2. Child: preop_checklist_items ──────────────────────────────────
--    Multiple checklist items per template, ordered by sort_order.
CREATE TABLE IF NOT EXISTS preop_checklist_items (
  item_id       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id   UUID        NOT NULL,          -- FK → preop_checklist_templates
  checklist_item VARCHAR(200) NOT NULL,
  sort_order    INTEGER     NOT NULL DEFAULT 1,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- ── 3. FK constraints (idempotent) ────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pct_procedure') THEN
    ALTER TABLE preop_checklist_templates
      ADD CONSTRAINT fk_pct_procedure
      FOREIGN KEY (procedure_id) REFERENCES surgery_types(surgery_type_id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pci_template') THEN
    ALTER TABLE preop_checklist_items
      ADD CONSTRAINT fk_pci_template
      FOREIGN KEY (template_id) REFERENCES preop_checklist_templates(template_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 4. Indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pct_procedure_id ON preop_checklist_templates(procedure_id);
CREATE INDEX IF NOT EXISTS idx_pct_is_active    ON preop_checklist_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_pci_template_id  ON preop_checklist_items(template_id);
CREATE INDEX IF NOT EXISTS idx_pci_sort_order   ON preop_checklist_items(template_id, sort_order);
