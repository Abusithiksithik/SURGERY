-- Sprint 1 S1-4: extend existing consumable_items; pharmacy_items intentionally unchanged.
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'CONSUMABLE';
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS is_billable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS generic_name VARCHAR(180);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS spec VARCHAR(180);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS brand VARCHAR(180);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS suture_brand_line VARCHAR(180);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS suture_size VARCHAR(50);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS needle_mm NUMERIC(8,2);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS needle_code VARCHAR(2);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS length_cm NUMERIC(8,2);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS material VARCHAR(100);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS absorbable BOOLEAN;
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS uom VARCHAR(30);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS pack_size NUMERIC(12,3);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS pack_uom VARCHAR(30);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS track_batch BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS track_expiry BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS track_serial BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC(12,2);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(12,3);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS min_level NUMERIC(12,3);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS default_vendor_id UUID REFERENCES vendors(vendor_id) ON DELETE SET NULL;
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS order_code VARCHAR(80);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(80);
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(user_id) ON DELETE SET NULL;
DO $$ BEGIN
 ALTER TABLE consumable_items ADD CONSTRAINT consumable_items_category_check CHECK (category IN ('MEDICINE','CONSUMABLE','PPE','SUTURE','IMPLANT','NON_BILLED','LINEN_RETURNABLE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
 ALTER TABLE consumable_items ADD CONSTRAINT consumable_items_needle_code_check CHECK (needle_code IS NULL OR needle_code IN ('RC','CT','SM','TP','RB','BP'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Legacy databases may have consumable_items without updated_at even though the base schema defines it.
-- Add it idempotently before normalizing existing item labels.
ALTER TABLE consumable_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT now();

-- Normalize whitespace for existing labels; do not silently merge duplicate records with live references.
UPDATE consumable_items SET item_name=regexp_replace(trim(item_name),'[[:space:]]+',' ','g'), updated_at=now()
WHERE item_name IS DISTINCT FROM regexp_replace(trim(item_name),'[[:space:]]+',' ','g');
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM consumable_items GROUP BY lower(trim(item_name)) HAVING COUNT(*)>1) THEN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_consumable_items_name_normalized ON consumable_items(lower(regexp_replace(trim(item_name),'[[:space:]]+',' ','g')));
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS item_import_log (
 import_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), source_file TEXT NOT NULL, source_row INTEGER,
 item_name TEXT, action VARCHAR(30) NOT NULL, message TEXT, created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT now(), updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
DO $$ BEGIN
 DROP TRIGGER IF EXISTS trg_phase1_audit_item_import_log ON item_import_log;
 CREATE TRIGGER trg_phase1_audit_item_import_log AFTER INSERT OR UPDATE OR DELETE ON item_import_log FOR EACH ROW EXECUTE FUNCTION fn_phase1_audit();
 DROP TRIGGER IF EXISTS trg_phase1_audit_consumable_items ON consumable_items;
 CREATE TRIGGER trg_phase1_audit_consumable_items AFTER INSERT OR UPDATE OR DELETE ON consumable_items FOR EACH ROW EXECUTE FUNCTION fn_phase1_audit();
END $$;
