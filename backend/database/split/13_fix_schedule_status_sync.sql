-- =====================================================================
-- 13_fix_schedule_status_sync.sql
-- Fix OT schedule records whose status is out of sync with Surgery Entry.
--
-- Root cause: prior code created OT schedules with status='DRAFT' even
-- when the surgery was already SCHEDULED/RESCHEDULED/POSTPONED/COMPLETED.
--
-- Mapping applied (OT schedule_status enum values only):
--   Surgery SCHEDULED / RESCHEDULED  → OT CONFIRMED
--   Surgery POSTPONED                → OT POSTPONED
--   Surgery SURGERY_COMPLETED        → OT COMPLETED
--   Surgery CANCELLED / DELETED      → OT CANCELLED  (already handled)
--
-- Fully idempotent — safe to run multiple times.
-- Only updates schedules that are genuinely out of sync.
-- Does NOT touch CANCELLED or COMPLETED OT schedules.
-- =====================================================================

-- SCHEDULED / RESCHEDULED surgery → OT should be CONFIRMED
UPDATE surgery_schedules ss
SET    status     = 'CONFIRMED',
       updated_at = now()
FROM   surgeries s
WHERE  s.surgery_id = ss.surgery_id
  AND  s.status IN ('SCHEDULED', 'RESCHEDULED')
  AND  ss.status NOT IN ('CANCELLED', 'CONFIRMED', 'COMPLETED');

-- POSTPONED surgery → OT should be POSTPONED
UPDATE surgery_schedules ss
SET    status     = 'POSTPONED',
       updated_at = now()
FROM   surgeries s
WHERE  s.surgery_id = ss.surgery_id
  AND  s.status = 'POSTPONED'
  AND  ss.status NOT IN ('CANCELLED', 'POSTPONED', 'COMPLETED');

-- SURGERY_COMPLETED / COMPLETED surgery → OT should be COMPLETED
UPDATE surgery_schedules ss
SET    status     = 'COMPLETED',
       updated_at = now()
FROM   surgeries s
WHERE  s.surgery_id = ss.surgery_id
  AND  s.status IN ('SURGERY_COMPLETED', 'COMPLETED')
  AND  ss.status NOT IN ('CANCELLED', 'COMPLETED');
