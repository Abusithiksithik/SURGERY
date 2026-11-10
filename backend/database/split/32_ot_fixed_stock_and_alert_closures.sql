-- OT dashboard fixed-stock targets and expiry-alert closures.
-- Balances remain derived from the append-only stock ledger.
CREATE TABLE IF NOT EXISTS ot_fixed_stock_targets (
  target_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES consumable_items(item_id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES stock_locations(location_id) ON DELETE RESTRICT,
  fixed_qty NUMERIC(14,3) NOT NULL CHECK (fixed_qty >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  configured_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ot_fixed_stock_item_location UNIQUE (item_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_ot_fixed_stock_location_active
  ON ot_fixed_stock_targets(location_id, is_active);

CREATE TABLE IF NOT EXISTS ot_stock_alert_closures (
  closure_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES consumable_items(item_id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES stock_locations(location_id) ON DELETE RESTRICT,
  batch_number VARCHAR(120),
  batch_key VARCHAR(120) GENERATED ALWAYS AS (COALESCE(batch_number, '')) STORED,
  expiry_date DATE NOT NULL,
  remarks TEXT NOT NULL CHECK (length(trim(remarks)) >= 3),
  closed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ot_expiry_alert_closure
  ON ot_stock_alert_closures(item_id, location_id, batch_key, expiry_date);

INSERT INTO system_permissions(permission_key, description) VALUES
 ('MANAGE_OT_FIXED_STOCK', 'Configure fixed OT stock quantities'),
 ('CLOSE_STOCK_ALERTS', 'Close OT stock expiry alerts with remarks')
ON CONFLICT (permission_key) DO NOTHING;
INSERT INTO system_role_permissions(role_name, permission_id, is_granted)
SELECT 'ADMIN', permission_id, TRUE FROM system_permissions
WHERE permission_key IN ('MANAGE_OT_FIXED_STOCK','CLOSE_STOCK_ALERTS')
ON CONFLICT (role_name, permission_id) DO UPDATE SET is_granted=TRUE;
INSERT INTO system_role_permissions(role_name, permission_id, is_granted)
SELECT 'OT_STORE', permission_id, TRUE FROM system_permissions
WHERE permission_key='CLOSE_STOCK_ALERTS'
ON CONFLICT (role_name, permission_id) DO NOTHING;
