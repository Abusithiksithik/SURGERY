-- =====================================================================
-- 14_surgery_checklist_and_docs.sql
-- Module 4 — Surgery Checklist (snapshot) + Surgery Documents
-- Fully idempotent. Safe to run multiple times.
-- =====================================================================

-- ── 1. checklist_item_status enum ────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checklist_item_status') THEN
    CREATE TYPE checklist_item_status AS ENUM ('PENDING', 'COMPLETED', 'NOT_APPLICABLE');
  END IF;
END $$;

-- ── 2. surgery_checklist — surgery-level snapshot of checklist items ──
--    Automatically created when a surgery becomes SCHEDULED.
--    item_label is snapshotted from preop_checklist_items.checklist_item
--    so changes to the template do not affect in-progress checklists.
CREATE TABLE IF NOT EXISTS surgery_checklist (
  checklist_id      UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  surgery_id        UUID                  NOT NULL,   -- FK → surgeries.surgery_id
  template_item_id  UUID                  NOT NULL,   -- FK → preop_checklist_items.item_id
  item_label        VARCHAR(200)          NOT NULL,   -- snapshot of checklist_item text
  sort_order        INTEGER               NOT NULL DEFAULT 1,
  status            checklist_item_status NOT NULL DEFAULT 'PENDING',
  completed_by      UUID,                             -- FK → users.user_id
  completed_at      TIMESTAMP(3),
  remarks           TEXT,
  created_at        TIMESTAMP(3)          NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP(3)          NOT NULL DEFAULT now(),
  UNIQUE (surgery_id, template_item_id)
);

-- ── 3. document_type enum ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
    CREATE TYPE document_type AS ENUM (
      'CONSENT_FORM',
      'PAC_REPORT',
      'INVESTIGATION_REPORT',
      'OTHER'
    );
  END IF;
END $$;

-- ── 4. surgery_documents — uploaded documents per surgery ─────────────
CREATE TABLE IF NOT EXISTS surgery_documents (
  document_id    UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  surgery_id     UUID           NOT NULL,             -- FK → surgeries.surgery_id
  document_type  document_type  NOT NULL DEFAULT 'OTHER',
  file_name      VARCHAR(260)   NOT NULL,
  file_path      TEXT           NOT NULL,
  file_size      INTEGER,
  mime_type      VARCHAR(120),
  uploaded_by    UUID,                                -- FK → users.user_id
  uploaded_at    TIMESTAMP(3)   NOT NULL DEFAULT now(),
  notes          TEXT,
  created_at     TIMESTAMP(3)   NOT NULL DEFAULT now()
);

-- ── 5. FK constraints (idempotent) ────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sc_surgery') THEN
    ALTER TABLE surgery_checklist
      ADD CONSTRAINT fk_sc_surgery
      FOREIGN KEY (surgery_id) REFERENCES surgeries(surgery_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sc_template_item') THEN
    ALTER TABLE surgery_checklist
      ADD CONSTRAINT fk_sc_template_item
      FOREIGN KEY (template_item_id) REFERENCES preop_checklist_items(item_id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sd_surgery') THEN
    ALTER TABLE surgery_documents
      ADD CONSTRAINT fk_sd_surgery
      FOREIGN KEY (surgery_id) REFERENCES surgeries(surgery_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 6. Indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sc_surgery_id       ON surgery_checklist(surgery_id);
CREATE INDEX IF NOT EXISTS idx_sc_template_item_id ON surgery_checklist(template_item_id);
CREATE INDEX IF NOT EXISTS idx_sc_status           ON surgery_checklist(status);
CREATE INDEX IF NOT EXISTS idx_sd_surgery_id       ON surgery_documents(surgery_id);
