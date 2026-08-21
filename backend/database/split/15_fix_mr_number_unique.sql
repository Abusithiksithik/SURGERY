-- 15_fix_mr_number_unique.sql
-- Fix: MR Number uniqueness should only apply to ACTIVE patients.
-- Soft-deleted (is_active = false) patients must NOT block reuse of their MR Number.
--
-- Steps:
--   1. Drop the old full unique constraint (covers all rows including deleted).
--   2. Create a partial unique index on (branch_id, mr_number) WHERE is_active = true.
--
-- Idempotent: wrapped in DO $$ blocks so re-running on next boot is safe.

DO $$
BEGIN
    -- Drop old constraint if it still exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_patients_branch_mr_number'
    ) THEN
        ALTER TABLE patients DROP CONSTRAINT uq_patients_branch_mr_number;
        RAISE NOTICE 'Dropped old constraint uq_patients_branch_mr_number';
    END IF;
END $$;

-- Create partial unique index (only active patients compete for MR numbers)
CREATE UNIQUE INDEX IF NOT EXISTS uix_patients_branch_mr_active
    ON patients (branch_id, mr_number)
    WHERE is_active = true;
