-- =====================================================================
-- 10_v11_requirements.sql
-- V11 Requirements — fully idempotent
-- Adds:
--   • staff table (unified surgeons/anaesthetists/assistants)
--   • ot_rooms.room_type column
--   • surgery_types.default_duration_min column
--   • surgeries.comments column (optional notes)
--   • surgeries.cancel_reason already exists in 07; guard below
--   • patients: age column (computed on read; use date_of_birth)
-- =====================================================================

-- ── 1. staff — unified staff table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  staff_id    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID,
  name        VARCHAR(120) NOT NULL,
  staff_type  VARCHAR(30)  NOT NULL CHECK (staff_type IN ('Surgeon','Anaesthetist','Assistant','Technician','Other')),
  employee_code VARCHAR(30),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_type ON staff(staff_type);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(is_active);

-- ── 2. ot_rooms.room_type ───────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='ot_rooms' AND column_name='room_type') THEN
    ALTER TABLE ot_rooms ADD COLUMN room_type VARCHAR(30) DEFAULT 'Major'
      CHECK (room_type IN ('Major','Minor','Cath Lab'));
  END IF;
END $$;

-- ── 3. surgery_types.default_duration_min ──────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='surgery_types' AND column_name='default_duration_min') THEN
    ALTER TABLE surgery_types ADD COLUMN default_duration_min INTEGER DEFAULT 60;
  END IF;
END $$;

-- ── 4. surgeries.comments ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='surgeries' AND column_name='comments') THEN
    ALTER TABLE surgeries ADD COLUMN comments TEXT;
  END IF;
END $$;

-- ── 5. Ensure cancel_reason exists (defensive guard from 07) ──────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='surgeries' AND column_name='cancel_reason') THEN
    ALTER TABLE surgeries ADD COLUMN cancel_reason TEXT;
  END IF;
END $$;

-- ── 6. Seed staff from existing surgeons + anaesthetists if empty ─────
-- Only seeds when staff table is empty to preserve existing data
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM staff) = 0 THEN
    INSERT INTO staff (branch_id, name, staff_type, employee_code, is_active, created_at, updated_at)
    SELECT branch_id, full_name, 'Surgeon', employee_code, is_active, created_at, updated_at
    FROM surgeons;

    INSERT INTO staff (branch_id, name, staff_type, employee_code, is_active, created_at, updated_at)
    SELECT branch_id, full_name, 'Anaesthetist', employee_code, is_active, created_at, updated_at
    FROM anaesthetists;

    INSERT INTO staff (branch_id, name, staff_type, employee_code, is_active, created_at, updated_at)
    SELECT branch_id, full_name, 'Assistant', employee_code, is_active, created_at, updated_at
    FROM assistants;
  END IF;
END $$;
