-- S3-3 prerequisite: separate approval permission for immutable physical-count adjustments.
-- No stock tables are added: adjustments are recorded in the existing append-only stock_ledger.
INSERT INTO system_permissions (permission_key, description)
VALUES ('APPROVE_STOCK_ADJUSTMENT', 'Approve physical stock count differences and append adjustment movements')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO system_role_permissions (role_name, permission_id, is_granted)
SELECT roles.role_name, p.permission_id, FALSE
FROM (SELECT DISTINCT role_name FROM system_role_permissions) roles
CROSS JOIN system_permissions p
WHERE p.permission_key = 'APPROVE_STOCK_ADJUSTMENT'
ON CONFLICT (role_name, permission_id) DO NOTHING;
