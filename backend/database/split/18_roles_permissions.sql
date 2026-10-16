-- Sprint 0: final role vocabulary, permission overrides, and permission seeds.
-- PostgreSQL enum values are added here; legacy user values are migrated in 19_professional_master.sql
-- after this file has committed, so newly-added enum labels are safe to use.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MANAGEMENT';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'OT_COORDINATOR';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SURGEON';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ANAESTHETIST';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'OT_NURSE';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'OT_TECHNICIAN';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'OT_STORE';

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES system_permissions(permission_id) ON DELETE CASCADE,
  is_granted BOOLEAN NOT NULL,
  granted_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  granted_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id)
);

INSERT INTO system_permissions(permission_key, description) VALUES
 ('APPROVE_BUDGET','Approve or revise a surgery budget'),
 ('FINALISE_PACKAGE','Finalise a surgery package'),
 ('APPROVE_BELOW_MARGIN_QUOTE','Approve a quote below target margin'),
 ('RECORD_COLLECTION','Record patient collections'),
 ('APPROVE_CONCESSION','Approve concessions'),
 ('APPROVE_PAYMENT','Approve payments'),
 ('RECORD_PAYMENT','Record payments'),
 ('RELEASE_STERILE_LOAD','Release a sterile load'),
 ('RELEASE_OT_AFTER_FUMIGATION','Release an OT after fumigation'),
 ('APPROVE_STOCK_ADJUSTMENT','Approve OT-store stock adjustments'),
 ('EDIT_MASTERS','Create and edit master data'),
 ('MANAGE_USERS','Create and manage application users'),
 ('VIEW_FINANCIALS','View financial information'),
 ('EDIT_SURGERY_ACTUALS','Edit surgery-day actuals'),
 ('VIEW_AUDIT_TRAIL','View the audit trail'),
 ('MANAGE_ROLE_PERMISSIONS','Manage role and user permission assignments'),
 ('VIEW_SURGERY_ACTUALS','View surgery-day actuals and timeline'),
 ('MARK_SURGERY_COMPLETED','Mark a surgery completed after actuals are recorded')
ON CONFLICT (permission_key) DO NOTHING;

-- Keep role grants conservative. Seed only missing role grants; do not overwrite later admin decisions on each startup.
CREATE TABLE IF NOT EXISTS app_migration_markers (marker_key VARCHAR(120) PRIMARY KEY, applied_at TIMESTAMP(3) NOT NULL DEFAULT now());
INSERT INTO system_role_permissions(role_name, permission_id, is_granted)
SELECT r.role_name, p.permission_id,
 CASE
   WHEN r.role_name='ADMIN' AND p.permission_key='MANAGE_ROLE_PERMISSIONS' THEN TRUE
   WHEN r.role_name='MANAGEMENT' AND p.permission_key IN ('VIEW_FINANCIALS','VIEW_AUDIT_TRAIL','VIEW_SURGERY_ACTUALS') THEN TRUE
   WHEN r.role_name='FINANCE' AND p.permission_key IN ('VIEW_FINANCIALS','RECORD_COLLECTION','RECORD_PAYMENT') THEN TRUE
   WHEN r.role_name='OT_COORDINATOR' AND p.permission_key IN ('VIEW_SURGERY_ACTUALS','EDIT_SURGERY_ACTUALS') THEN TRUE
   WHEN r.role_name='SURGEON' AND p.permission_key='VIEW_SURGERY_ACTUALS' THEN TRUE
   ELSE FALSE
 END
FROM (VALUES ('ADMIN'),('MANAGEMENT'),('FINANCE'),('OT_COORDINATOR'),('SURGEON'),('ANAESTHETIST'),('OT_NURSE'),('OT_TECHNICIAN'),('OT_STORE'),('VIEWER')) r(role_name)
CROSS JOIN system_permissions p
ON CONFLICT (role_name, permission_id) DO NOTHING;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM app_migration_markers WHERE marker_key='18_initial_role_permission_seed') THEN
  UPDATE system_role_permissions rp SET is_granted=CASE
    WHEN rp.role_name='ADMIN' AND p.permission_key='MANAGE_ROLE_PERMISSIONS' THEN TRUE
    WHEN rp.role_name='MANAGEMENT' AND p.permission_key IN ('VIEW_FINANCIALS','VIEW_AUDIT_TRAIL','VIEW_SURGERY_ACTUALS') THEN TRUE
    WHEN rp.role_name='FINANCE' AND p.permission_key IN ('VIEW_FINANCIALS','RECORD_COLLECTION','RECORD_PAYMENT') THEN TRUE
    WHEN rp.role_name='OT_COORDINATOR' AND p.permission_key IN ('VIEW_SURGERY_ACTUALS','EDIT_SURGERY_ACTUALS') THEN TRUE
    WHEN rp.role_name='SURGEON' AND p.permission_key='VIEW_SURGERY_ACTUALS' THEN TRUE
    ELSE FALSE END, updated_at=now()
   FROM system_permissions p WHERE p.permission_id=rp.permission_id;
  INSERT INTO app_migration_markers(marker_key) VALUES('18_initial_role_permission_seed') ON CONFLICT DO NOTHING;
 END IF;
END $$;
