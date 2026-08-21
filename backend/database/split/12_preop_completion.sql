-- =====================================================================
-- 12_preop_completion.sql
-- Module 4 — Surgery-level Pre-Op Checklist Completion
-- Stores which checklist items have been checked for each surgery.
-- Fully idempotent. Safe to run multiple times.
-- =====================================================================

-- One row per (surgery_id, item_id) pair — checked or unchecked.
CREATE TABLE IF NOT EXISTS surgery_preop_completions (
  completion_id  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  surgery_id     UUID         NOT NULL,          -- FK → surgeries.surgery_id
  item_id        UUID         NOT NULL,          -- FK → preop_checklist_items.item_id
  is_checked     BOOLEAN      NOT NULL DEFAULT FALSE,
  checked_by     UUID,                           -- FK → users.user_id (nullable)
  checked_at     TIMESTAMP(3),
  created_at     TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE (surgery_id, item_id)
);

-- FK constraints (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spc_surgery') THEN
    ALTER TABLE surgery_preop_completions
      ADD CONSTRAINT fk_spc_surgery
      FOREIGN KEY (surgery_id) REFERENCES surgeries(surgery_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spc_item') THEN
    ALTER TABLE surgery_preop_completions
      ADD CONSTRAINT fk_spc_item
      FOREIGN KEY (item_id) REFERENCES preop_checklist_items(item_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_spc_surgery_id ON surgery_preop_completions(surgery_id);
CREATE INDEX IF NOT EXISTS idx_spc_item_id    ON surgery_preop_completions(item_id);
