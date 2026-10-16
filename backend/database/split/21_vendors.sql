-- Sprint 1 S1-3: vendor master.
CREATE TABLE IF NOT EXISTS vendors (
 vendor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 name VARCHAR(180) NOT NULL,
 vendor_type VARCHAR(30) NOT NULL CHECK (vendor_type IN ('IMPLANT_SUPPLIER','PHARMA_SUPPLIER','EQUIPMENT_AMC','GAS_SUPPLIER','LAUNDRY','OTHER')),
 contact_person VARCHAR(160), phone VARCHAR(40), email VARCHAR(160), address TEXT, gstin VARCHAR(30), remarks TEXT,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT now(), updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendors_name_ci ON vendors(lower(trim(name)));
INSERT INTO vendors(name,vendor_type) VALUES ('Southern Gases Pvt Ltd','GAS_SUPPLIER'),('Siemens Service','EQUIPMENT_AMC') ON CONFLICT DO NOTHING;
DO $$ BEGIN
 DROP TRIGGER IF EXISTS trg_phase1_audit_vendors ON vendors;
 CREATE TRIGGER trg_phase1_audit_vendors AFTER INSERT OR UPDATE OR DELETE ON vendors FOR EACH ROW EXECUTE FUNCTION fn_phase1_audit();
END $$;
