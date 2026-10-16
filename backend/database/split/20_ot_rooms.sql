-- Sprint 1 S1-2: OT room operational status and turnaround.
ALTER TABLE ot_rooms ADD COLUMN IF NOT EXISTS turnaround_min INTEGER NOT NULL DEFAULT 30;
ALTER TABLE ot_rooms ADD COLUMN IF NOT EXISTS ot_status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE ot_rooms ADD COLUMN IF NOT EXISTS location TEXT;
DO $$ BEGIN
 ALTER TABLE ot_rooms ADD CONSTRAINT ot_rooms_ot_status_check CHECK (ot_status IN ('AVAILABLE','IN_USE','UNDER_FUMIGATION','AWAITING_CLEARANCE','MAINTENANCE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
 ALTER TABLE ot_rooms ADD CONSTRAINT ot_rooms_turnaround_min_check CHECK (turnaround_min >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
