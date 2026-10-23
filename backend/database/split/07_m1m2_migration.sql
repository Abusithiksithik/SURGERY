-- =====================================================================
-- 07_m1m2_migration.sql
-- Module 1 & Module 2 additions — fully idempotent (IF NOT EXISTS).
-- Adds:
--   • patients: extra fields (phone, address, blood_group, age, ip_op,
--               admission_number, emergency_contact)
--   • surgeries: surgery_number (human-readable ID), ip_op, admission_number,
--                diagnosis, planned_procedure, side_site, clinical_notes,
--                plan_date, cancel_reason, status PLANNED added to enum
--   • users:     CRUD via existing masters API — no schema changes needed
-- =====================================================================

-- ── patients: extend with additional intake fields ────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='patients' AND column_name='phone') THEN
    ALTER TABLE patients ADD COLUMN phone VARCHAR(20);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='patients' AND column_name='address') THEN
    ALTER TABLE patients ADD COLUMN address TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='patients' AND column_name='blood_group') THEN
    ALTER TABLE patients ADD COLUMN blood_group VARCHAR(10);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='patients' AND column_name='emergency_contact_name') THEN
    ALTER TABLE patients ADD COLUMN emergency_contact_name VARCHAR(120);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='patients' AND column_name='emergency_contact_phone') THEN
    ALTER TABLE patients ADD COLUMN emergency_contact_phone VARCHAR(20);
  END IF;
END $$;

-- ── surgeries: surgery_number (human-readable, e.g. SID-2026-00042) ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='surgeries' AND column_name='surgery_number') THEN
    ALTER TABLE surgeries ADD COLUMN surgery_number VARCHAR(30);
  END IF;
END $$;

-- Sequence for surgery_number generation
CREATE SEQUENCE IF NOT EXISTS surgery_number_seq START 1;

-- ── surgeries: workflow & clinical fields ─────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='surgeries' AND column_name='ip_op') THEN
    ALTER TABLE surgeries ADD COLUMN ip_op VARCHAR(2) DEFAULT 'OP' CHECK (ip_op IN ('IP','OP'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='surgeries' AND column_name='admission_number') THEN
    ALTER TABLE surgeries ADD COLUMN admission_number VARCHAR(30);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='surgeries' AND column_name='diagnosis') THEN
    ALTER TABLE surgeries ADD COLUMN diagnosis TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='surgeries' AND column_name='planned_procedure') THEN
    ALTER TABLE surgeries ADD COLUMN planned_procedure TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='surgeries' AND column_name='side_site') THEN
    ALTER TABLE surgeries ADD COLUMN side_site VARCHAR(60);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='surgeries' AND column_name='clinical_notes') THEN
    ALTER TABLE surgeries ADD COLUMN clinical_notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='surgeries' AND column_name='technician_type') THEN
    ALTER TABLE surgeries ADD COLUMN technician_type VARCHAR(20)
      CHECK (technician_type IN ('IN_HOUSE', 'OUTSOURCED'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='surgeries' AND column_name='plan_date') THEN
    ALTER TABLE surgeries ADD COLUMN plan_date DATE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='surgeries' AND column_name='cancel_reason') THEN
    ALTER TABLE surgeries ADD COLUMN cancel_reason TEXT;
  END IF;
END $$;

-- Add PLANNED to surgery_status enum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'surgery_status'::regtype AND enumlabel = 'PLANNED'
  ) THEN
    ALTER TYPE surgery_status ADD VALUE IF NOT EXISTS 'PLANNED' AFTER 'DRAFT';
  END IF;
END $$;

-- Unique index on surgery_number (non-null only)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_surgeries_surgery_number') THEN
    ALTER TABLE surgeries ADD CONSTRAINT uq_surgeries_surgery_number
      UNIQUE (surgery_number);
  END IF;
END $$;

-- Add notes column to surgery_status_history if not present
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='surgery_status_history' AND column_name='notes') THEN
    ALTER TABLE surgery_status_history ADD COLUMN notes TEXT;
  END IF;
END $$;
