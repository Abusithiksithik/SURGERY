-- Migration 28: repair legacy consumable_items timestamp drift.
-- Some existing hospital databases were created before the timestamp columns
-- were consistently present. Keep this additive and safe to run once.
ALTER TABLE consumable_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) NOT NULL DEFAULT now();

ALTER TABLE consumable_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT now();

-- Backfill defensively for installations where columns existed but were nullable.
UPDATE consumable_items
SET created_at = COALESCE(created_at, now()),
    updated_at = COALESCE(updated_at, created_at, now())
WHERE created_at IS NULL OR updated_at IS NULL;

ALTER TABLE consumable_items
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;
