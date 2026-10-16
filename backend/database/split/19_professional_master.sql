-- Sprint 1 S1-1: unified professional identity. Safe to run repeatedly.
-- Enum labels were added by 18_roles_permissions.sql in the preceding startup query.

-- Legacy databases may predate the qualification field. Ensure it exists before
-- backfilling staff and creating the compatibility trigger below.
ALTER TABLE anaesthetists ADD COLUMN IF NOT EXISTS qualification VARCHAR(120);
UPDATE users SET role='MANAGEMENT' WHERE role::text='MANAGER';
UPDATE users SET role='SURGEON' WHERE role::text='DOCTOR';

ALTER TABLE staff ADD COLUMN IF NOT EXISTS legacy_surgeon_id UUID UNIQUE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS legacy_anaesthetist_id UUID UNIQUE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS legacy_assistant_id UUID UNIQUE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS qualification VARCHAR(160);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS registration_no VARCHAR(100);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS specialty VARCHAR(160);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email VARCHAR(160);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS payout_reference TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(user_id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_staff_type_check;
  ALTER TABLE staff ADD CONSTRAINT staff_staff_type_check CHECK (staff_type IN ('Surgeon','Anaesthetist','Assistant','Technician','Nurse','Visiting Specialist','Other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS staff_backfill_review (
  review_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('Surgeon','Anaesthetist','Assistant')),
  source_id UUID NOT NULL,
  source_name VARCHAR(120) NOT NULL,
  candidate_staff_ids UUID[] NOT NULL DEFAULT '{}',
  resolution_status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (resolution_status IN ('OPEN','RESOLVED','IGNORED')),
  resolution_notes TEXT,
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_id)
);

-- Link only unambiguous name+type matches. No ambiguous identity is guessed.
WITH source_rows AS (
 SELECT 'Surgeon'::text AS typ, surgeon_id AS source_id, full_name AS source_name FROM surgeons
 UNION ALL SELECT 'Anaesthetist', anaesthetist_id, full_name FROM anaesthetists
 UNION ALL SELECT 'Assistant', assistant_id, full_name FROM assistants
), matches AS (
 SELECT s.typ, s.source_id, s.source_name, st.staff_id,
        COUNT(st.staff_id) OVER (PARTITION BY s.typ,s.source_id) AS match_count
 FROM source_rows s LEFT JOIN staff st
   ON lower(trim(st.name))=lower(trim(s.source_name)) AND st.staff_type=s.typ
), linked AS (
 SELECT * FROM matches WHERE match_count=1 AND staff_id IS NOT NULL
)
UPDATE staff st SET
 legacy_surgeon_id = CASE WHEN l.typ='Surgeon' THEN l.source_id ELSE st.legacy_surgeon_id END,
 legacy_anaesthetist_id = CASE WHEN l.typ='Anaesthetist' THEN l.source_id ELSE st.legacy_anaesthetist_id END,
 legacy_assistant_id = CASE WHEN l.typ='Assistant' THEN l.source_id ELSE st.legacy_assistant_id END,
 updated_at=now()
FROM linked l WHERE st.staff_id=l.staff_id;

-- Insert unmatched people only when no exact name+type match exists.
INSERT INTO staff(branch_id,name,staff_type,employee_code,is_active,legacy_surgeon_id,created_at,updated_at)
SELECT s.branch_id,s.full_name,'Surgeon',s.employee_code,s.is_active,s.surgeon_id,s.created_at,s.updated_at
FROM surgeons s WHERE NOT EXISTS (SELECT 1 FROM staff st WHERE lower(trim(st.name))=lower(trim(s.full_name)) AND st.staff_type='Surgeon')
ON CONFLICT DO NOTHING;
INSERT INTO staff(branch_id,name,staff_type,employee_code,is_active,legacy_anaesthetist_id,qualification,created_at,updated_at)
SELECT a.branch_id,a.full_name,'Anaesthetist',a.employee_code,a.is_active,a.anaesthetist_id,a.qualification,a.created_at,a.updated_at
FROM anaesthetists a WHERE NOT EXISTS (SELECT 1 FROM staff st WHERE lower(trim(st.name))=lower(trim(a.full_name)) AND st.staff_type='Anaesthetist')
ON CONFLICT DO NOTHING;
INSERT INTO staff(branch_id,name,staff_type,employee_code,is_active,legacy_assistant_id,created_at,updated_at)
SELECT a.branch_id,a.full_name,'Assistant',a.employee_code,a.is_active,a.assistant_id,a.created_at,a.updated_at
FROM assistants a WHERE NOT EXISTS (SELECT 1 FROM staff st WHERE lower(trim(st.name))=lower(trim(a.full_name)) AND st.staff_type='Assistant')
ON CONFLICT DO NOTHING;

-- Report ambiguous matches for human resolution.
WITH source_rows AS (
 SELECT 'Surgeon'::text AS typ, surgeon_id AS source_id, full_name AS source_name FROM surgeons
 UNION ALL SELECT 'Anaesthetist', anaesthetist_id, full_name FROM anaesthetists
 UNION ALL SELECT 'Assistant', assistant_id, full_name FROM assistants
), candidates AS (
 SELECT s.typ,s.source_id,s.source_name, array_agg(st.staff_id) FILTER (WHERE st.staff_id IS NOT NULL) AS ids,
        COUNT(st.staff_id) AS n
 FROM source_rows s JOIN staff st ON lower(trim(st.name))=lower(trim(s.source_name)) AND st.staff_type=s.typ
 GROUP BY s.typ,s.source_id,s.source_name
 HAVING COUNT(st.staff_id)>1
)
INSERT INTO staff_backfill_review(source_type,source_id,source_name,candidate_staff_ids)
SELECT typ,source_id,source_name,ids FROM candidates
ON CONFLICT(source_type,source_id) DO UPDATE SET candidate_staff_ids=EXCLUDED.candidate_staff_ids,updated_at=now();

-- Staff is the primary identity for new professionals; keep the legacy FK tables in sync for older case columns.
CREATE OR REPLACE FUNCTION fn_sync_staff_to_legacy_professional() RETURNS trigger AS $$
DECLARE branch UUID; legacy_id UUID;
BEGIN
 IF NEW.staff_type NOT IN ('Surgeon','Anaesthetist','Assistant') THEN RETURN NEW; END IF;
 branch:=COALESCE(NEW.branch_id,(SELECT branch_id FROM branches WHERE is_active=TRUE ORDER BY created_at LIMIT 1));
 IF branch IS NULL THEN RETURN NEW; END IF;
 IF NEW.staff_type='Surgeon' THEN
  IF NEW.legacy_surgeon_id IS NULL THEN
   INSERT INTO surgeons(branch_id,full_name,employee_code,specialization,is_active)
   VALUES(branch,NEW.name,NEW.employee_code,NEW.specialty,NEW.is_active) RETURNING surgeon_id INTO legacy_id;
   UPDATE staff SET legacy_surgeon_id=legacy_id WHERE staff_id=NEW.staff_id AND legacy_surgeon_id IS NULL;
  ELSE
   UPDATE surgeons SET branch_id=branch,full_name=NEW.name,employee_code=NEW.employee_code,specialization=NEW.specialty,is_active=NEW.is_active,updated_at=now()
    WHERE surgeon_id=NEW.legacy_surgeon_id AND (branch_id IS DISTINCT FROM branch OR full_name IS DISTINCT FROM NEW.name OR employee_code IS DISTINCT FROM NEW.employee_code OR specialization IS DISTINCT FROM NEW.specialty OR is_active IS DISTINCT FROM NEW.is_active);
  END IF;
 ELSIF NEW.staff_type='Anaesthetist' THEN
  IF NEW.legacy_anaesthetist_id IS NULL THEN
   INSERT INTO anaesthetists(branch_id,full_name,employee_code,qualification,is_active)
   VALUES(branch,NEW.name,NEW.employee_code,NEW.qualification,NEW.is_active) RETURNING anaesthetist_id INTO legacy_id;
   UPDATE staff SET legacy_anaesthetist_id=legacy_id WHERE staff_id=NEW.staff_id AND legacy_anaesthetist_id IS NULL;
  ELSE
   UPDATE anaesthetists SET branch_id=branch,full_name=NEW.name,employee_code=NEW.employee_code,qualification=NEW.qualification,is_active=NEW.is_active,updated_at=now()
    WHERE anaesthetist_id=NEW.legacy_anaesthetist_id AND (branch_id IS DISTINCT FROM branch OR full_name IS DISTINCT FROM NEW.name OR employee_code IS DISTINCT FROM NEW.employee_code OR qualification IS DISTINCT FROM NEW.qualification OR is_active IS DISTINCT FROM NEW.is_active);
  END IF;
 ELSE
  IF NEW.legacy_assistant_id IS NULL THEN
   INSERT INTO assistants(branch_id,full_name,employee_code,role_title,is_active)
   VALUES(branch,NEW.name,NEW.employee_code,NEW.specialty,NEW.is_active) RETURNING assistant_id INTO legacy_id;
   UPDATE staff SET legacy_assistant_id=legacy_id WHERE staff_id=NEW.staff_id AND legacy_assistant_id IS NULL;
  ELSE
   UPDATE assistants SET branch_id=branch,full_name=NEW.name,employee_code=NEW.employee_code,role_title=NEW.specialty,is_active=NEW.is_active,updated_at=now()
    WHERE assistant_id=NEW.legacy_assistant_id AND (branch_id IS DISTINCT FROM branch OR full_name IS DISTINCT FROM NEW.name OR employee_code IS DISTINCT FROM NEW.employee_code OR role_title IS DISTINCT FROM NEW.specialty OR is_active IS DISTINCT FROM NEW.is_active);
  END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_staff_to_legacy_professional ON staff;
CREATE TRIGGER trg_sync_staff_to_legacy_professional AFTER INSERT OR UPDATE OF name,branch_id,staff_type,employee_code,qualification,specialty,is_active ON staff FOR EACH ROW EXECUTE FUNCTION fn_sync_staff_to_legacy_professional();

-- Audit function scrubs sensitive fields from all audit payloads.
CREATE OR REPLACE FUNCTION fn_phase1_audit() RETURNS trigger AS $$
DECLARE old_json JSONB; new_json JSONB; row_json JSONB; rid UUID; sid UUID; actor UUID;
BEGIN
 old_json := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD)-'password_hash'-'payout_reference' ELSE NULL END;
 new_json := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW)-'password_hash'-'payout_reference' ELSE NULL END;
 row_json := COALESCE(new_json,old_json);
 BEGIN
  rid := COALESCE(NULLIF(row_json->>'surgery_id','')::uuid,NULLIF(row_json->>'actual_id','')::uuid,NULLIF(row_json->>'event_id','')::uuid,NULLIF(row_json->>'checklist_id','')::uuid,NULLIF(row_json->>'document_id','')::uuid,NULLIF(row_json->>'schedule_id','')::uuid,NULLIF(row_json->>'staff_id','')::uuid,NULLIF(row_json->>'vendor_id','')::uuid,NULLIF(row_json->>'asset_id','')::uuid,NULLIF(row_json->>'user_id','')::uuid,NULLIF(row_json->>'id','')::uuid);
 EXCEPTION WHEN invalid_text_representation THEN rid := NULL; END;
 BEGIN sid := NULLIF(COALESCE(new_json->>'surgery_id',old_json->>'surgery_id'),'')::uuid; EXCEPTION WHEN invalid_text_representation THEN sid := NULL; END;
 BEGIN actor := NULLIF(current_setting('app.user_id',true),'')::uuid; EXCEPTION WHEN invalid_text_representation THEN actor := NULL; END;
 INSERT INTO audit_log(table_name,record_id,surgery_id,action,changed_by,old_values,new_values)
 VALUES(TG_TABLE_NAME,COALESCE(rid,gen_random_uuid()),sid,TG_OP,actor,old_json,new_json);
 RETURN COALESCE(NEW,OLD);
END; $$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['branches','departments','patients','surgeries','surgery_status_history','surgery_checklist','surgery_documents','surgery_schedules','surgery_actuals','surgery_actual_team','surgery_timeline_events','preop_checklists','preop_checklist_items','preop_templates','surgery_types','ot_rooms','staff','staff_backfill_review','users','surgeons','anaesthetists','assistants','consumable_items','pharmacy_items','alert_thresholds','system_role_permissions','user_permissions','surgery_collections','surgery_consumables','surgery_pharmacy','surgery_assistants','budget_recommendations','recommendation_overrides'] LOOP
  IF to_regclass(t) IS NOT NULL THEN
   EXECUTE format('DROP TRIGGER IF EXISTS trg_phase1_audit_%I ON %I',t,t);
   EXECUTE format('CREATE TRIGGER trg_phase1_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_phase1_audit()',t,t);
  END IF;
 END LOOP;
END $$;
