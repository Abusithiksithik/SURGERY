-- =====================================================================
-- 09_status_workflow.sql
-- Adds new surgery status enum values for the full workflow,
-- creates blood_group_options master table.
-- Fully idempotent — safe to run multiple times.
-- =====================================================================

-- ── 1. New surgery_status enum values ─────────────────────────────────
-- PostgreSQL ALTER TYPE … ADD VALUE is not transactional in older versions,
-- but "IF NOT EXISTS" guard makes this idempotent.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'surgery_status'::regtype AND enumlabel = 'SENT_FOR_BUDGET_APPROVAL') THEN
    ALTER TYPE surgery_status ADD VALUE 'SENT_FOR_BUDGET_APPROVAL' AFTER 'PLANNED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'surgery_status'::regtype AND enumlabel = 'BUDGET_APPROVED') THEN
    ALTER TYPE surgery_status ADD VALUE 'BUDGET_APPROVED' AFTER 'SENT_FOR_BUDGET_APPROVAL';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'surgery_status'::regtype AND enumlabel = 'REVISE_BUDGET') THEN
    ALTER TYPE surgery_status ADD VALUE 'REVISE_BUDGET' AFTER 'BUDGET_APPROVED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'surgery_status'::regtype AND enumlabel = 'RESCHEDULED') THEN
    ALTER TYPE surgery_status ADD VALUE 'RESCHEDULED' AFTER 'SCHEDULED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'surgery_status'::regtype AND enumlabel = 'POSTPONED') THEN
    ALTER TYPE surgery_status ADD VALUE 'POSTPONED' AFTER 'RESCHEDULED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'surgery_status'::regtype AND enumlabel = 'SURGERY_COMPLETED') THEN
    ALTER TYPE surgery_status ADD VALUE 'SURGERY_COMPLETED' AFTER 'POSTPONED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'surgery_status'::regtype AND enumlabel = 'PARTIALLY_RECONCILED') THEN
    ALTER TYPE surgery_status ADD VALUE 'PARTIALLY_RECONCILED' AFTER 'SURGERY_COMPLETED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'surgery_status'::regtype AND enumlabel = 'FULLY_RECONCILED') THEN
    ALTER TYPE surgery_status ADD VALUE 'FULLY_RECONCILED' AFTER 'PARTIALLY_RECONCILED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'surgery_status'::regtype AND enumlabel = 'CLOSED') THEN
    ALTER TYPE surgery_status ADD VALUE 'CLOSED' AFTER 'FULLY_RECONCILED';
  END IF;
END $$;

-- ── 2. blood_group_options — master table for blood groups ─────────────
CREATE TABLE IF NOT EXISTS blood_group_options (
  blood_group_id  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(10)  NOT NULL,
  label           VARCHAR(30)  NOT NULL,
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_blood_group_code ON blood_group_options(code);

-- Seed default blood groups (idempotent via ON CONFLICT)
INSERT INTO blood_group_options (code, label, sort_order) VALUES
  ('A+',      'A Positive',  1),
  ('A-',      'A Negative',  2),
  ('B+',      'B Positive',  3),
  ('B-',      'B Negative',  4),
  ('AB+',     'AB Positive', 5),
  ('AB-',     'AB Negative', 6),
  ('O+',      'O Positive',  7),
  ('O-',      'O Negative',  8),
  ('Unknown', 'Unknown',     9)
ON CONFLICT (code) DO NOTHING;

-- ── 3. surgery_schedules: add budget_approval_locked column ──────────
-- Tracks whether budget editing is locked (after Budget Approved)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='surgeries' AND column_name='budget_locked') THEN
    ALTER TABLE surgeries ADD COLUMN budget_locked BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;
