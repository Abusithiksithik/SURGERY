-- =====================================================================
-- 04_constraints.sql
-- Unique constraints and foreign keys.
-- Every ALTER TABLE … ADD CONSTRAINT is wrapped in a DO block that
-- checks pg_constraint first — fully idempotent, safe to re-run.
-- =====================================================================

-- -----------------------------------------------------------------------
-- Helper macro: add constraint only if it does not already exist.
-- PostgreSQL 9.x+ — works in all supported versions.
-- -----------------------------------------------------------------------
-- Pattern:
--   DO $$ BEGIN
--       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '<name>') THEN
--           ALTER TABLE <table> ADD CONSTRAINT <name> ...;
--       END IF;
--   END $$;
-- -----------------------------------------------------------------------

-- =====================================================================
-- UNIQUE CONSTRAINTS
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_branches_branch_code') THEN
        ALTER TABLE branches ADD CONSTRAINT uq_branches_branch_code UNIQUE (branch_code);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_departments_branch_code') THEN
        ALTER TABLE departments ADD CONSTRAINT uq_departments_branch_code UNIQUE (branch_id, department_code);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_username') THEN
        ALTER TABLE users ADD CONSTRAINT uq_users_username UNIQUE (username);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_email') THEN
        ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_surgeons_employee_code') THEN
        ALTER TABLE surgeons ADD CONSTRAINT uq_surgeons_employee_code UNIQUE (employee_code);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_anaesthetists_employee_code') THEN
        ALTER TABLE anaesthetists ADD CONSTRAINT uq_anaesthetists_employee_code UNIQUE (employee_code);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_assistants_employee_code') THEN
        ALTER TABLE assistants ADD CONSTRAINT uq_assistants_employee_code UNIQUE (employee_code);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_surgery_types_code') THEN
        ALTER TABLE surgery_types ADD CONSTRAINT uq_surgery_types_code UNIQUE (code);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ot_rooms_branch_room_code') THEN
        ALTER TABLE ot_rooms ADD CONSTRAINT uq_ot_rooms_branch_room_code UNIQUE (branch_id, room_code);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_patients_branch_mr_number') THEN
        ALTER TABLE patients ADD CONSTRAINT uq_patients_branch_mr_number UNIQUE (branch_id, mr_number);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_consumable_items_item_code') THEN
        ALTER TABLE consumable_items ADD CONSTRAINT uq_consumable_items_item_code UNIQUE (item_code);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_pharmacy_items_item_code') THEN
        ALTER TABLE pharmacy_items ADD CONSTRAINT uq_pharmacy_items_item_code UNIQUE (item_code);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_surgery_assistants_surgery_assistant') THEN
        ALTER TABLE surgery_assistants ADD CONSTRAINT uq_surgery_assistants_surgery_assistant UNIQUE (surgery_id, assistant_id);
    END IF;
END $$;

-- alert_thresholds: branch_id can be NULL (global threshold).
-- A standard UNIQUE(branch_id, alert_type) treats NULL != NULL so multiple
-- global rows per alert_type would be allowed. Use a unique index with
-- COALESCE so NULL branch_id behaves like a real value for uniqueness.
-- The index is created in 05_indexes.sql using IF NOT EXISTS.
-- (No plain ALTER TABLE constraint here — the index IS the constraint.)

-- =====================================================================
-- FOREIGN KEYS — departments
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_departments_branch') THEN
        ALTER TABLE departments
            ADD CONSTRAINT fk_departments_branch
            FOREIGN KEY (branch_id) REFERENCES branches (branch_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — users
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_branch') THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_branch
            FOREIGN KEY (branch_id) REFERENCES branches (branch_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — surgeons
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgeons_branch') THEN
        ALTER TABLE surgeons
            ADD CONSTRAINT fk_surgeons_branch
            FOREIGN KEY (branch_id) REFERENCES branches (branch_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgeons_department') THEN
        ALTER TABLE surgeons
            ADD CONSTRAINT fk_surgeons_department
            FOREIGN KEY (department_id) REFERENCES departments (department_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — anaesthetists
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_anaesthetists_branch') THEN
        ALTER TABLE anaesthetists
            ADD CONSTRAINT fk_anaesthetists_branch
            FOREIGN KEY (branch_id) REFERENCES branches (branch_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — assistants
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assistants_branch') THEN
        ALTER TABLE assistants
            ADD CONSTRAINT fk_assistants_branch
            FOREIGN KEY (branch_id) REFERENCES branches (branch_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — surgery_types
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_types_department') THEN
        ALTER TABLE surgery_types
            ADD CONSTRAINT fk_surgery_types_department
            FOREIGN KEY (department_id) REFERENCES departments (department_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — ot_rooms
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ot_rooms_branch') THEN
        ALTER TABLE ot_rooms
            ADD CONSTRAINT fk_ot_rooms_branch
            FOREIGN KEY (branch_id) REFERENCES branches (branch_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — patients
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_patients_branch') THEN
        ALTER TABLE patients
            ADD CONSTRAINT fk_patients_branch
            FOREIGN KEY (branch_id) REFERENCES branches (branch_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — surgeries
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgeries_branch') THEN
        ALTER TABLE surgeries
            ADD CONSTRAINT fk_surgeries_branch
            FOREIGN KEY (branch_id) REFERENCES branches (branch_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgeries_department') THEN
        ALTER TABLE surgeries
            ADD CONSTRAINT fk_surgeries_department
            FOREIGN KEY (department_id) REFERENCES departments (department_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgeries_patient') THEN
        ALTER TABLE surgeries
            ADD CONSTRAINT fk_surgeries_patient
            FOREIGN KEY (patient_id) REFERENCES patients (patient_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgeries_surgeon') THEN
        ALTER TABLE surgeries
            ADD CONSTRAINT fk_surgeries_surgeon
            FOREIGN KEY (surgeon_id) REFERENCES surgeons (surgeon_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgeries_anaesthetist') THEN
        ALTER TABLE surgeries
            ADD CONSTRAINT fk_surgeries_anaesthetist
            FOREIGN KEY (anaesthetist_id) REFERENCES anaesthetists (anaesthetist_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgeries_surgery_type') THEN
        ALTER TABLE surgeries
            ADD CONSTRAINT fk_surgeries_surgery_type
            FOREIGN KEY (surgery_type_id) REFERENCES surgery_types (surgery_type_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgeries_ot_room') THEN
        ALTER TABLE surgeries
            ADD CONSTRAINT fk_surgeries_ot_room
            FOREIGN KEY (ot_room_id) REFERENCES ot_rooms (ot_room_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgeries_created_by') THEN
        ALTER TABLE surgeries
            ADD CONSTRAINT fk_surgeries_created_by
            FOREIGN KEY (created_by) REFERENCES users (user_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgeries_updated_by') THEN
        ALTER TABLE surgeries
            ADD CONSTRAINT fk_surgeries_updated_by
            FOREIGN KEY (updated_by) REFERENCES users (user_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — surgery_assistants
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_assistants_surgery') THEN
        ALTER TABLE surgery_assistants
            ADD CONSTRAINT fk_surgery_assistants_surgery
            FOREIGN KEY (surgery_id) REFERENCES surgeries (surgery_id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_assistants_assistant') THEN
        ALTER TABLE surgery_assistants
            ADD CONSTRAINT fk_surgery_assistants_assistant
            FOREIGN KEY (assistant_id) REFERENCES assistants (assistant_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — surgery_consumables
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_consumables_surgery') THEN
        ALTER TABLE surgery_consumables
            ADD CONSTRAINT fk_surgery_consumables_surgery
            FOREIGN KEY (surgery_id) REFERENCES surgeries (surgery_id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_consumables_item') THEN
        ALTER TABLE surgery_consumables
            ADD CONSTRAINT fk_surgery_consumables_item
            FOREIGN KEY (item_id) REFERENCES consumable_items (item_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — surgery_pharmacy
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_pharmacy_surgery') THEN
        ALTER TABLE surgery_pharmacy
            ADD CONSTRAINT fk_surgery_pharmacy_surgery
            FOREIGN KEY (surgery_id) REFERENCES surgeries (surgery_id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_pharmacy_item') THEN
        ALTER TABLE surgery_pharmacy
            ADD CONSTRAINT fk_surgery_pharmacy_item
            FOREIGN KEY (pharmacy_item_id) REFERENCES pharmacy_items (pharmacy_item_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — surgery_collections
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_collections_surgery') THEN
        ALTER TABLE surgery_collections
            ADD CONSTRAINT fk_surgery_collections_surgery
            FOREIGN KEY (surgery_id) REFERENCES surgeries (surgery_id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_collections_recorded_by') THEN
        ALTER TABLE surgery_collections
            ADD CONSTRAINT fk_surgery_collections_recorded_by
            FOREIGN KEY (recorded_by) REFERENCES users (user_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — budget_recommendations
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_budget_recommendations_surgery') THEN
        ALTER TABLE budget_recommendations
            ADD CONSTRAINT fk_budget_recommendations_surgery
            FOREIGN KEY (surgery_id) REFERENCES surgeries (surgery_id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_budget_recommendations_generated_by') THEN
        ALTER TABLE budget_recommendations
            ADD CONSTRAINT fk_budget_recommendations_generated_by
            FOREIGN KEY (generated_by) REFERENCES users (user_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — recommendation_overrides
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_recommendation_overrides_recommendation') THEN
        ALTER TABLE recommendation_overrides
            ADD CONSTRAINT fk_recommendation_overrides_recommendation
            FOREIGN KEY (recommendation_id) REFERENCES budget_recommendations (recommendation_id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_recommendation_overrides_surgery') THEN
        ALTER TABLE recommendation_overrides
            ADD CONSTRAINT fk_recommendation_overrides_surgery
            FOREIGN KEY (surgery_id) REFERENCES surgeries (surgery_id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_recommendation_overrides_overridden_by') THEN
        ALTER TABLE recommendation_overrides
            ADD CONSTRAINT fk_recommendation_overrides_overridden_by
            FOREIGN KEY (overridden_by) REFERENCES users (user_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — alert_thresholds
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_thresholds_branch') THEN
        ALTER TABLE alert_thresholds
            ADD CONSTRAINT fk_alert_thresholds_branch
            FOREIGN KEY (branch_id) REFERENCES branches (branch_id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — surgery_alerts
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_alerts_surgery') THEN
        ALTER TABLE surgery_alerts
            ADD CONSTRAINT fk_surgery_alerts_surgery
            FOREIGN KEY (surgery_id) REFERENCES surgeries (surgery_id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_alerts_acknowledged_by') THEN
        ALTER TABLE surgery_alerts
            ADD CONSTRAINT fk_surgery_alerts_acknowledged_by
            FOREIGN KEY (acknowledged_by) REFERENCES users (user_id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- FOREIGN KEYS — surgery_status_history
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_status_history_surgery') THEN
        ALTER TABLE surgery_status_history
            ADD CONSTRAINT fk_surgery_status_history_surgery
            FOREIGN KEY (surgery_id) REFERENCES surgeries (surgery_id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- BACKFILL: ot_rooms missing timestamp columns
-- The ot_rooms table was created from an older schema that omitted
-- created_at / updated_at. The masters.service.js list() function
-- always sorts by ORDER BY created_at DESC; without these columns
-- every GET /api/v1/masters/ot-rooms request returns HTTP 500.
-- ADD COLUMN IF NOT EXISTS is idempotent — safe to re-run on every
-- startup and on fresh installs that already have the columns.
-- =====================================================================

ALTER TABLE ot_rooms
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) NOT NULL DEFAULT now();

ALTER TABLE ot_rooms
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT now();
