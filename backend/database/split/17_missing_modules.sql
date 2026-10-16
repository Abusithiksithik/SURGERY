-- =====================================================================
-- 17_missing_modules.sql
-- Missing Phase-1 modules only. Existing surgery/budget/scheduling logic is
-- intentionally left unchanged.
-- =====================================================================

CREATE TABLE IF NOT EXISTS surgery_actuals (
  actual_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  surgery_id UUID NOT NULL UNIQUE REFERENCES surgeries(surgery_id) ON DELETE CASCADE,
  actual_surgery_date DATE,
  ot_room_id UUID REFERENCES ot_rooms(ot_room_id) ON DELETE SET NULL,
  actual_start_time TIME,
  procedure_performed_text VARCHAR(500),
  procedure_modified_flag BOOLEAN NOT NULL DEFAULT FALSE,
  additional_procedure_text TEXT,
  emergency_unplanned_flag BOOLEAN NOT NULL DEFAULT FALSE,
  anaesthesia_type VARCHAR(100),
  complications TEXT,
  equipment_used TEXT,
  implants_used TEXT,
  sutures_used TEXT,
  staplers_staples_used TEXT,
  other_materials_used TEXT,
  special_instructions TEXT,
  post_op_instructions TEXT,
  remarks TEXT,
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS surgery_actual_team (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  surgery_id UUID NOT NULL REFERENCES surgeries(surgery_id) ON DELETE CASCADE,
  team_role VARCHAR(40) NOT NULL CHECK (team_role IN ('PRIMARY_SURGEON','CO_SURGEON','ASSISTANT','ANAESTHETIST','OT_ASSISTANT','OTHER')),
  staff_id UUID NOT NULL REFERENCES staff(staff_id) ON DELETE RESTRICT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE (surgery_id, team_role, staff_id)
);

CREATE TABLE IF NOT EXISTS surgery_timeline_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  surgery_id UUID NOT NULL REFERENCES surgeries(surgery_id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'PATIENT_ENTERED_OT','ANAESTHESIA_STARTED','SURGERY_STARTED',
    'ADDITIONAL_PROCEDURE','SURGERY_COMPLETED','ANAESTHESIA_COMPLETED',
    'PATIENT_SHIFTED_OUT'
  )),
  event_datetime TIMESTAMP(3) NOT NULL,
  recorded_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE (surgery_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_surgery_actuals_surgery ON surgery_actuals(surgery_id);
CREATE INDEX IF NOT EXISTS idx_actual_team_surgery ON surgery_actual_team(surgery_id);
CREATE INDEX IF NOT EXISTS idx_timeline_surgery_datetime ON surgery_timeline_events(surgery_id, event_datetime);

-- Audit viewer needs surgery-level filtering without changing the existing
-- audit_log payload model.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='audit_log' AND column_name='surgery_id') THEN
    ALTER TABLE audit_log ADD COLUMN surgery_id UUID REFERENCES surgeries(surgery_id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_audit_log_surgery_id ON audit_log(surgery_id);

-- Database trigger audit for the missing actuals module and the existing
-- surgery/checklist/document records. It is additive and does not alter
-- existing business behavior.
CREATE OR REPLACE FUNCTION fn_phase1_audit() RETURNS trigger AS $$
DECLARE
  old_json JSONB;
  new_json JSONB;
  row_json JSONB;
  rid UUID;
  sid UUID;
  actor UUID;
BEGIN
  old_json := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  new_json := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  row_json := COALESCE(new_json, old_json);

  BEGIN
    rid := COALESCE(
      NULLIF(row_json->>'surgery_id','')::uuid,
      NULLIF(row_json->>'actual_id','')::uuid,
      NULLIF(row_json->>'event_id','')::uuid,
      NULLIF(row_json->>'checklist_id','')::uuid,
      NULLIF(row_json->>'document_id','')::uuid,
      NULLIF(row_json->>'schedule_id','')::uuid,
      NULLIF(row_json->>'id','')::uuid
    );
  EXCEPTION WHEN invalid_text_representation THEN
    rid := NULL;
  END;

  BEGIN
    sid := NULLIF(COALESCE(new_json->>'surgery_id', old_json->>'surgery_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    sid := NULL;
  END;

  IF TG_TABLE_NAME = 'surgeries' THEN
    BEGIN
      sid := COALESCE(sid, NULLIF(COALESCE(new_json->>'surgery_id', old_json->>'surgery_id'), '')::uuid);
    EXCEPTION WHEN invalid_text_representation THEN NULL; END;
  END IF;

  BEGIN
    actor := NULLIF(current_setting('app.user_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    actor := NULL;
  END;

  INSERT INTO audit_log(table_name, record_id, surgery_id, action, changed_by, old_values, new_values)
  VALUES (TG_TABLE_NAME, COALESCE(rid, gen_random_uuid()), sid, TG_OP, actor, old_json, new_json);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'surgeries','surgery_checklist','surgery_documents',
    'surgery_schedules','surgery_actuals','surgery_actual_team','surgery_timeline_events'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_phase1_audit_%I ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_phase1_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_phase1_audit()', t, t);
  END LOOP;
END $$;

-- Permission assignments for the existing application roles. We keep this
-- separate from the existing user_role enum so no current login/role data is
-- changed.
CREATE TABLE IF NOT EXISTS system_permissions (
  permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  permission_key VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_role_permissions (
  role_name VARCHAR(40) NOT NULL,
  permission_id UUID NOT NULL REFERENCES system_permissions(permission_id) ON DELETE CASCADE,
  is_granted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  PRIMARY KEY (role_name, permission_id)
);

INSERT INTO system_permissions(permission_key, description) VALUES
  ('VIEW_SURGERY_ACTUALS','View surgery-day actuals and timeline'),
  ('EDIT_SURGERY_ACTUALS','Create or edit surgery-day actuals and timeline'),
  ('MARK_SURGERY_COMPLETED','Mark a surgery completed after actuals are recorded'),
  ('VIEW_AUDIT_TRAIL','View system audit trail'),
  ('MANAGE_ROLE_PERMISSIONS','Manage role permission assignments')
ON CONFLICT (permission_key) DO NOTHING;

-- Safe initial grants for the roles already used by the application.
INSERT INTO system_role_permissions(role_name, permission_id, is_granted)
SELECT r.role_name, p.permission_id,
       CASE WHEN r.role_name = 'ADMIN' THEN TRUE
            WHEN p.permission_key IN ('VIEW_SURGERY_ACTUALS','EDIT_SURGERY_ACTUALS')
              AND r.role_name IN ('SURGEON','OT_COORDINATOR') THEN TRUE
            WHEN p.permission_key = 'VIEW_AUDIT_TRAIL'
              AND r.role_name IN ('ADMIN','MANAGEMENT') THEN TRUE
            ELSE FALSE END
FROM (VALUES ('ADMIN'),('FINANCE'),('MANAGEMENT'),('SURGEON'),('OT_COORDINATOR'),('VIEWER')) r(role_name)
CROSS JOIN system_permissions p
ON CONFLICT (role_name, permission_id) DO NOTHING;
