-- =====================================================================
-- 08_m3_scheduling.sql
-- Module 3 — Surgery Scheduling / OT Booking
-- Fully idempotent. Safe to run multiple times.
-- =====================================================================

-- ── 1. schedule_priority enum ─────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_priority') THEN
    CREATE TYPE schedule_priority AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');
  END IF;
END $$;

-- ── 2. schedule_status enum ───────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_status') THEN
    CREATE TYPE schedule_status AS ENUM (
      'DRAFT',
      'CONFIRMED',
      'IN_PROGRESS',
      'COMPLETED',
      'POSTPONED',
      'CANCELLED'
    );
  END IF;
END $$;

-- ── 3. surgery_schedules — one active schedule per surgery ────────────
CREATE TABLE IF NOT EXISTS surgery_schedules (
  schedule_id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  surgery_id             UUID           NOT NULL,          -- FK → surgeries.surgery_id
  surgery_number         VARCHAR(30),                      -- denormalised copy for display

  -- Scheduling fields
  planned_date           DATE           NOT NULL,
  planned_start_time     TIME           NOT NULL,
  expected_duration_min  INTEGER        NOT NULL DEFAULT 60,  -- minutes
  ot_room_id             UUID,                             -- FK → ot_rooms
  priority               schedule_priority NOT NULL DEFAULT 'ROUTINE',

  -- Team
  primary_surgeon_id     UUID,                             -- FK → surgeons
  co_surgeon_id          UUID,                             -- FK → surgeons (optional)
  anaesthetist_id        UUID,                             -- FK → anaesthetists
  other_personnel        TEXT,                             -- free-text (nurses, techs, etc.)

  -- Status
  status                 schedule_status NOT NULL DEFAULT 'DRAFT',

  -- Audit
  created_by             UUID,
  updated_by             UUID,
  created_at             TIMESTAMP(3)   NOT NULL DEFAULT now(),
  updated_at             TIMESTAMP(3)   NOT NULL DEFAULT now()
);

-- ── 4. surgery_schedule_assistants — M2M for assistant doctors ────────
CREATE TABLE IF NOT EXISTS surgery_schedule_assistants (
  id             UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id    UUID  NOT NULL,
  assistant_id   UUID  NOT NULL,
  created_at     TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- ── 5. surgery_schedule_history — immutable audit trail ───────────────
CREATE TABLE IF NOT EXISTS surgery_schedule_history (
  history_id     UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id    UUID           NOT NULL,
  surgery_id     UUID           NOT NULL,
  action         VARCHAR(40)    NOT NULL,   -- CREATED|RESCHEDULED|OT_CHANGED|TEAM_CHANGED|POSTPONED|CANCELLED|CONFIRMED
  reason         TEXT,
  snapshot       JSONB          NOT NULL,   -- full schedule state before change
  changed_by     UUID,
  changed_at     TIMESTAMP(3)   NOT NULL DEFAULT now()
);

-- ── 6. FK constraints (idempotent) ────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ss_surgery') THEN
    ALTER TABLE surgery_schedules
      ADD CONSTRAINT fk_ss_surgery
      FOREIGN KEY (surgery_id) REFERENCES surgeries(surgery_id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ss_ot_room') THEN
    ALTER TABLE surgery_schedules
      ADD CONSTRAINT fk_ss_ot_room
      FOREIGN KEY (ot_room_id) REFERENCES ot_rooms(ot_room_id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ss_primary_surgeon') THEN
    ALTER TABLE surgery_schedules
      ADD CONSTRAINT fk_ss_primary_surgeon
      FOREIGN KEY (primary_surgeon_id) REFERENCES surgeons(surgeon_id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ss_co_surgeon') THEN
    ALTER TABLE surgery_schedules
      ADD CONSTRAINT fk_ss_co_surgeon
      FOREIGN KEY (co_surgeon_id) REFERENCES surgeons(surgeon_id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ss_anaesthetist') THEN
    ALTER TABLE surgery_schedules
      ADD CONSTRAINT fk_ss_anaesthetist
      FOREIGN KEY (anaesthetist_id) REFERENCES anaesthetists(anaesthetist_id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ssa_schedule') THEN
    ALTER TABLE surgery_schedule_assistants
      ADD CONSTRAINT fk_ssa_schedule
      FOREIGN KEY (schedule_id) REFERENCES surgery_schedules(schedule_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ssa_assistant') THEN
    ALTER TABLE surgery_schedule_assistants
      ADD CONSTRAINT fk_ssa_assistant
      FOREIGN KEY (assistant_id) REFERENCES assistants(assistant_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 7. Indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_surgery_schedules_surgery_id  ON surgery_schedules(surgery_id);
CREATE INDEX IF NOT EXISTS idx_surgery_schedules_planned_date ON surgery_schedules(planned_date);
CREATE INDEX IF NOT EXISTS idx_surgery_schedules_ot_room      ON surgery_schedules(ot_room_id);
CREATE INDEX IF NOT EXISTS idx_schedule_history_schedule_id   ON surgery_schedule_history(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_history_surgery_id    ON surgery_schedule_history(surgery_id);

-- ── Ensure patients.is_active exists (older DBs may not have it) ─────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'patients' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE patients ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
END $$;

-- ── Data cleanup: deactivate excess sample patients (MR004–MR008) ────
-- These are kept for historical surgery data integrity but hidden from
-- the patient dropdown. Only MR001–MR003 remain active for testing.
UPDATE patients
   SET is_active = FALSE, updated_at = now()
 WHERE mr_number IN ('MR004','MR005','MR006','MR007','MR008')
   AND branch_id = '00000000-0000-0000-0000-000000000001';
