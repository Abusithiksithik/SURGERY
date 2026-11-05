-- Sprint 3 / S3-1: OT Store foundation and append-only stock ledger.
-- Additive migration: reuses consumable_items, vendors, users, surgeries,
-- system_permissions, system_role_permissions and audit_log from prior migrations.

-- One OT store location for the initial rollout. Additional locations can be
-- introduced later without changing the ledger model.
CREATE TABLE IF NOT EXISTS stock_locations (
  location_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_code VARCHAR(40) NOT NULL,
  location_name VARCHAR(160) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT ck_stock_locations_code_nonempty CHECK (length(trim(location_code)) > 0),
  CONSTRAINT ck_stock_locations_name_nonempty CHECK (length(trim(location_name)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_locations_code_ci
  ON stock_locations (lower(trim(location_code)));

INSERT INTO stock_locations (location_code, location_name)
VALUES ('OT_STORE', 'OT Store')
ON CONFLICT DO NOTHING;

-- Receipt header is an immutable source document. Item-level quantities and
-- costs are recorded in stock_ledger rows referencing this header.
CREATE TABLE IF NOT EXISTS stock_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES stock_locations(location_id) ON DELETE RESTRICT,
  vendor_id UUID REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
  receipt_number VARCHAR(100),
  invoice_number VARCHAR(100),
  invoice_date DATE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  device_id VARCHAR(120),
  reference_number VARCHAR(120),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_stock_receipts_reference CHECK (
    receipt_number IS NULL OR length(trim(receipt_number)) > 0
  )
);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_received_at
  ON stock_receipts (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_vendor
  ON stock_receipts (vendor_id, received_at DESC);

-- Every stock movement is represented by exactly one immutable ledger row.
-- Quantities are expressed in the item's base UOM, not purchase-pack units.
CREATE TABLE IF NOT EXISTS stock_ledger (
  ledger_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES consumable_items(item_id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES stock_locations(location_id) ON DELETE RESTRICT,
  txn_type VARCHAR(20) NOT NULL,
  qty_in NUMERIC(14,3) NOT NULL DEFAULT 0,
  qty_out NUMERIC(14,3) NOT NULL DEFAULT 0,
  uom VARCHAR(30) NOT NULL,
  batch_number VARCHAR(120),
  expiry_date DATE,
  serial_number VARCHAR(160),
  unit_cost NUMERIC(14,2),
  surgery_id UUID REFERENCES surgeries(surgery_id) ON DELETE RESTRICT,
  vendor_id UUID REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
  receipt_id UUID REFERENCES stock_receipts(receipt_id) ON DELETE RESTRICT,
  reference_number VARCHAR(160),
  reason TEXT,
  reversal_of_ledger_id UUID REFERENCES stock_ledger(ledger_id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ,
  approval_reason TEXT,
  idempotency_key UUID NOT NULL,
  entered_by UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  device_id VARCHAR(120),
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  txn_date DATE GENERATED ALWAYS AS ((entered_at AT TIME ZONE 'Asia/Kolkata')::date) STORED,
  CONSTRAINT ck_stock_ledger_txn_type CHECK (
    txn_type IN ('OPENING','RECEIPT','ISSUE_CASE','RETURN_CASE','WASTAGE','ADJUSTMENT','REVERSAL')
  ),
  CONSTRAINT ck_stock_ledger_one_direction CHECK (
    (qty_in > 0 AND qty_out = 0) OR (qty_out > 0 AND qty_in = 0)
  ),
  CONSTRAINT ck_stock_ledger_uom_nonempty CHECK (length(trim(uom)) > 0),
  CONSTRAINT ck_stock_ledger_nonnegative_cost CHECK (unit_cost IS NULL OR unit_cost >= 0),
  CONSTRAINT ck_stock_ledger_batch_required_for_expiry CHECK (expiry_date IS NULL OR batch_number IS NOT NULL),
  CONSTRAINT ck_stock_ledger_approval_pair CHECK (
    (approved_by IS NULL AND approved_at IS NULL) OR
    (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT ck_stock_ledger_adjustment_reason CHECK (
    txn_type <> 'ADJUSTMENT' OR length(trim(COALESCE(reason, ''))) > 0
  ),
  CONSTRAINT ck_stock_ledger_receipt_reference CHECK (
    txn_type <> 'RECEIPT' OR receipt_id IS NOT NULL
  ),
  CONSTRAINT ck_stock_ledger_case_reference CHECK (
    txn_type NOT IN ('ISSUE_CASE','RETURN_CASE','WASTAGE') OR surgery_id IS NOT NULL
  ),
  CONSTRAINT ck_stock_ledger_reversal_reference CHECK (
    (txn_type = 'REVERSAL' AND reversal_of_ledger_id IS NOT NULL AND length(trim(COALESCE(reason, ''))) > 0)
    OR (txn_type <> 'REVERSAL' AND reversal_of_ledger_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_ledger_idempotency
  ON stock_ledger (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_ledger_single_reversal
  ON stock_ledger (reversal_of_ledger_id)
  WHERE reversal_of_ledger_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_ledger_item_location_date
  ON stock_ledger (item_id, location_id, txn_date);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_batch_expiry
  ON stock_ledger (item_id, location_id, expiry_date)
  WHERE batch_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_ledger_surgery
  ON stock_ledger (surgery_id, entered_at DESC)
  WHERE surgery_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_ledger_receipt
  ON stock_ledger (receipt_id)
  WHERE receipt_id IS NOT NULL;

-- A reversal must exactly negate one original non-reversal movement. The unique
-- index above ensures an original movement cannot be reversed twice.
CREATE OR REPLACE FUNCTION fn_validate_stock_reversal() RETURNS trigger AS $$
DECLARE original stock_ledger%ROWTYPE;
BEGIN
  IF NEW.txn_type <> 'REVERSAL' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO original
  FROM stock_ledger
  WHERE ledger_id = NEW.reversal_of_ledger_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original stock ledger row was not found';
  END IF;
  IF original.txn_type = 'REVERSAL' THEN
    RAISE EXCEPTION 'A reversal cannot itself be reversed';
  END IF;
  IF NEW.item_id IS DISTINCT FROM original.item_id
     OR NEW.location_id IS DISTINCT FROM original.location_id
     OR NEW.batch_number IS DISTINCT FROM original.batch_number
     OR NEW.expiry_date IS DISTINCT FROM original.expiry_date
     OR NEW.serial_number IS DISTINCT FROM original.serial_number
     OR NEW.uom IS DISTINCT FROM original.uom
     OR NEW.qty_in IS DISTINCT FROM original.qty_out
     OR NEW.qty_out IS DISTINCT FROM original.qty_in THEN
    RAISE EXCEPTION 'Reversal must exactly negate the original stock movement';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_stock_reversal ON stock_ledger;
CREATE TRIGGER trg_validate_stock_reversal
  BEFORE INSERT ON stock_ledger
  FOR EACH ROW EXECUTE FUNCTION fn_validate_stock_reversal();

-- The balance is derived only from the ledger; it is never stored or edited.
CREATE OR REPLACE VIEW v_stock_balance AS
SELECT
  sl.item_id,
  sl.location_id,
  sl.batch_number,
  sl.expiry_date,
  sl.serial_number,
  ci.item_code,
  ci.item_name,
  COALESCE(ci.uom, ci.unit, MIN(sl.uom)) AS uom,
  SUM(sl.qty_in - sl.qty_out)::NUMERIC(14,3) AS on_hand_qty,
  MIN(sl.expiry_date) FILTER (WHERE sl.expiry_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date) AS next_expiry_date,
  (ARRAY_AGG(sl.unit_cost ORDER BY sl.entered_at DESC)
    FILTER (WHERE sl.unit_cost IS NOT NULL AND sl.txn_type IN ('RECEIPT','OPENING')))[1] AS last_receipt_cost,
  MAX(sl.entered_at) AS last_movement_at
FROM stock_ledger sl
JOIN consumable_items ci ON ci.item_id = sl.item_id
GROUP BY sl.item_id, sl.location_id, sl.batch_number, sl.expiry_date, sl.serial_number,
         ci.item_code, ci.item_name, ci.uom, ci.unit;

-- Append-only enforcement for the financial/stock source records.
CREATE OR REPLACE FUNCTION fn_reject_stock_record_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; record a reversal/correction instead', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_ledger_append_only ON stock_ledger;
CREATE TRIGGER trg_stock_ledger_append_only
  BEFORE UPDATE OR DELETE ON stock_ledger
  FOR EACH ROW EXECUTE FUNCTION fn_reject_stock_record_mutation();

DROP TRIGGER IF EXISTS trg_stock_receipts_append_only ON stock_receipts;
CREATE TRIGGER trg_stock_receipts_append_only
  BEFORE UPDATE OR DELETE ON stock_receipts
  FOR EACH ROW EXECUTE FUNCTION fn_reject_stock_record_mutation();

-- Dedicated audit function records the actual primary key for each new table.
-- Ledger and receipt audit events are INSERT-only because those records are immutable.
CREATE OR REPLACE FUNCTION fn_stock_sprint3_audit() RETURNS trigger AS $$
DECLARE
  row_json JSONB;
  record_uuid UUID;
  actor_uuid UUID;
BEGIN
  row_json := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  BEGIN
    record_uuid := COALESCE(
      NULLIF(row_json->>'ledger_id', '')::uuid,
      NULLIF(row_json->>'receipt_id', '')::uuid,
      NULLIF(row_json->>'location_id', '')::uuid
    );
  EXCEPTION WHEN invalid_text_representation THEN
    record_uuid := gen_random_uuid();
  END;
  BEGIN
    actor_uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    actor_uuid := NULL;
  END;
  INSERT INTO audit_log(table_name, record_id, surgery_id, action, changed_by, old_values, new_values)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(record_uuid, gen_random_uuid()),
    CASE WHEN TG_TABLE_NAME = 'stock_ledger' THEN NULLIF(row_json->>'surgery_id', '')::uuid ELSE NULL END,
    TG_OP,
    actor_uuid,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_s3_audit_stock_locations ON stock_locations;
CREATE TRIGGER trg_s3_audit_stock_locations
  AFTER INSERT OR UPDATE OR DELETE ON stock_locations
  FOR EACH ROW EXECUTE FUNCTION fn_stock_sprint3_audit();
DROP TRIGGER IF EXISTS trg_s3_audit_stock_receipts ON stock_receipts;
CREATE TRIGGER trg_s3_audit_stock_receipts
  AFTER INSERT ON stock_receipts
  FOR EACH ROW EXECUTE FUNCTION fn_stock_sprint3_audit();
DROP TRIGGER IF EXISTS trg_s3_audit_stock_ledger ON stock_ledger;
CREATE TRIGGER trg_s3_audit_stock_ledger
  AFTER INSERT ON stock_ledger
  FOR EACH ROW EXECUTE FUNCTION fn_stock_sprint3_audit();

-- Seed permissions without changing any existing role or user grants.
INSERT INTO system_permissions (permission_key, description) VALUES
  ('RECEIVE_STOCK', 'Receive stock into an OT store location'),
  ('ENTER_CASE_USAGE', 'Record stock used, returned or wasted for a surgery'),
  ('RECORD_GAS', 'Record OT piped gas and cylinder usage'),
  ('RECORD_PHARMACY_BILL', 'Record pharmacy billing handover for case usage')
ON CONFLICT (permission_key) DO NOTHING;

-- Create explicit deny-by-default role rows for the new permissions. Existing
-- admin/user overrides are preserved; an administrator can grant access later.
INSERT INTO system_role_permissions (role_name, permission_id, is_granted)
SELECT roles.role_name, p.permission_id, FALSE
FROM (SELECT DISTINCT role_name FROM system_role_permissions) roles
CROSS JOIN system_permissions p
WHERE p.permission_key IN ('RECEIVE_STOCK','ENTER_CASE_USAGE','RECORD_GAS','RECORD_PHARMACY_BILL')
ON CONFLICT (role_name, permission_id) DO NOTHING;

COMMENT ON TABLE stock_ledger IS 'Append-only OT stock movement ledger; on-hand quantity is derived from this table.';
COMMENT ON VIEW v_stock_balance IS 'Derived stock balance grouped by item, location, batch, expiry and serial.';
