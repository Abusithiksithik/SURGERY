-- S3-2: Surgery case stock consumption. Append-only usage and billing handover.
-- All stock quantities remain authoritative in stock_ledger.

ALTER TABLE stock_ledger
  ADD COLUMN IF NOT EXISTS usage_id UUID;

CREATE TABLE IF NOT EXISTS surgery_usage_lines (
  usage_id UUID PRIMARY KEY,
  surgery_id UUID NOT NULL REFERENCES surgeries(surgery_id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES consumable_items(item_id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES stock_locations(location_id) ON DELETE RESTRICT,
  issue_ledger_id UUID NOT NULL UNIQUE REFERENCES stock_ledger(ledger_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  quantity_issued NUMERIC(14,3) NOT NULL CHECK (quantity_issued > 0),
  uom VARCHAR(30) NOT NULL CHECK (length(trim(uom)) > 0),
  unit_cost NUMERIC(14,2) NOT NULL CHECK (unit_cost >= 0),
  batch_number VARCHAR(120),
  expiry_date DATE,
  serial_number VARCHAR(160),
  notes TEXT,
  issued_by UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stock_ledger
  ADD CONSTRAINT fk_stock_ledger_usage
  FOREIGN KEY (usage_id) REFERENCES surgery_usage_lines(usage_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_surgery_usage_case ON surgery_usage_lines(surgery_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_surgery_usage_item ON surgery_usage_lines(item_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_usage ON stock_ledger(usage_id, txn_type) WHERE usage_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pharmacy_billing_handover (
  handover_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usage_id UUID NOT NULL UNIQUE REFERENCES surgery_usage_lines(usage_id) ON DELETE RESTRICT,
  surgery_id UUID NOT NULL REFERENCES surgeries(surgery_id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES consumable_items(item_id) ON DELETE RESTRICT,
  billable_quantity NUMERIC(14,3) NOT NULL CHECK (billable_quantity >= 0),
  uom VARCHAR(30) NOT NULL,
  unit_cost NUMERIC(14,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost NUMERIC(14,2) GENERATED ALWAYS AS (round(billable_quantity * unit_cost, 2)) STORED,
  handed_over_by UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  handed_over_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_handover_surgery ON pharmacy_billing_handover(surgery_id, handed_over_at DESC);

CREATE OR REPLACE FUNCTION fn_reject_surgery_usage_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; record a compensating stock movement instead', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_surgery_usage_append_only ON surgery_usage_lines;
CREATE TRIGGER trg_surgery_usage_append_only
  BEFORE UPDATE OR DELETE ON surgery_usage_lines
  FOR EACH ROW EXECUTE FUNCTION fn_reject_surgery_usage_mutation();
DROP TRIGGER IF EXISTS trg_pharmacy_handover_append_only ON pharmacy_billing_handover;
CREATE TRIGGER trg_pharmacy_handover_append_only
  BEFORE UPDATE OR DELETE ON pharmacy_billing_handover
  FOR EACH ROW EXECUTE FUNCTION fn_reject_surgery_usage_mutation();

CREATE TABLE IF NOT EXISTS surgery_usage_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key UUID NOT NULL UNIQUE,
  usage_id UUID NOT NULL REFERENCES surgery_usage_lines(usage_id) ON DELETE RESTRICT,
  event_type VARCHAR(12) NOT NULL CHECK (event_type IN ('RETURN','WASTAGE')),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  ledger_id UUID REFERENCES stock_ledger(ledger_id) ON DELETE RESTRICT,
  notes TEXT,
  recorded_by UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_usage_event_ledger CHECK ((event_type='RETURN' AND ledger_id IS NOT NULL) OR (event_type='WASTAGE' AND ledger_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_surgery_usage_events_usage ON surgery_usage_events(usage_id, recorded_at DESC);
DROP TRIGGER IF EXISTS trg_surgery_usage_events_append_only ON surgery_usage_events;
CREATE TRIGGER trg_surgery_usage_events_append_only
  BEFORE UPDATE OR DELETE ON surgery_usage_events
  FOR EACH ROW EXECUTE FUNCTION fn_reject_surgery_usage_mutation();

INSERT INTO system_permissions (permission_key, description) VALUES
  ('ENTER_CASE_USAGE', 'Record stock issued, returned or wasted for a surgery'),
  ('RECORD_PHARMACY_BILL', 'Hand over case consumables to pharmacy for billing')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO system_role_permissions (role_name, permission_id, is_granted)
SELECT roles.role_name, p.permission_id, FALSE
FROM (SELECT DISTINCT role_name FROM system_role_permissions) roles
CROSS JOIN system_permissions p
WHERE p.permission_key IN ('ENTER_CASE_USAGE','RECORD_PHARMACY_BILL')
ON CONFLICT (role_name, permission_id) DO NOTHING;

COMMENT ON TABLE surgery_usage_lines IS 'Immutable issue lines for OT case consumption; returns and wastage are represented by linked stock ledger movements.';
COMMENT ON TABLE pharmacy_billing_handover IS 'Immutable one-time handover of case usage to pharmacy; this system does not create patient bills.';

-- Extend the existing S3 audit trigger to capture the actual new-table IDs and case IDs.
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
      NULLIF(row_json->>'location_id', '')::uuid,
      NULLIF(row_json->>'usage_id', '')::uuid,
      NULLIF(row_json->>'event_id', '')::uuid,
      NULLIF(row_json->>'handover_id', '')::uuid
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
    TG_TABLE_NAME, COALESCE(record_uuid, gen_random_uuid()),
    NULLIF(row_json->>'surgery_id', '')::uuid, TG_OP, actor_uuid,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_s3_audit_surgery_usage ON surgery_usage_lines;
CREATE TRIGGER trg_s3_audit_surgery_usage AFTER INSERT ON surgery_usage_lines
  FOR EACH ROW EXECUTE FUNCTION fn_stock_sprint3_audit();
DROP TRIGGER IF EXISTS trg_s3_audit_surgery_usage_events ON surgery_usage_events;
CREATE TRIGGER trg_s3_audit_surgery_usage_events AFTER INSERT ON surgery_usage_events
  FOR EACH ROW EXECUTE FUNCTION fn_stock_sprint3_audit();
DROP TRIGGER IF EXISTS trg_s3_audit_pharmacy_handover ON pharmacy_billing_handover;
CREATE TRIGGER trg_s3_audit_pharmacy_handover AFTER INSERT ON pharmacy_billing_handover
  FOR EACH ROW EXECUTE FUNCTION fn_stock_sprint3_audit();

CREATE OR REPLACE VIEW v_surgery_stock_usage_cost AS
SELECT u.surgery_id,
       SUM((u.quantity_issued - COALESCE(ev.returned_qty,0)) * u.unit_cost)::NUMERIC(14,2) AS actual_consumables_cost,
       SUM(GREATEST(u.quantity_issued - COALESCE(ev.returned_qty,0) - COALESCE(ev.wasted_qty,0),0) * u.unit_cost)::NUMERIC(14,2) AS pharmacy_billable_cost,
       COUNT(*)::INTEGER AS usage_line_count
  FROM surgery_usage_lines u
  LEFT JOIN LATERAL (
    SELECT SUM(quantity) FILTER (WHERE event_type='RETURN') AS returned_qty,
           SUM(quantity) FILTER (WHERE event_type='WASTAGE') AS wasted_qty
      FROM surgery_usage_events WHERE usage_id=u.usage_id
  ) ev ON TRUE
 GROUP BY u.surgery_id;
COMMENT ON VIEW v_surgery_stock_usage_cost IS 'Actual OT stock consumption cost by surgery; returned quantities are excluded, wastage remains a case cost.';
