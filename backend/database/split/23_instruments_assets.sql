-- Sprint 1 S1-5: instruments, sets, composition and assets.
CREATE TABLE IF NOT EXISTS instruments (
 instrument_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(180) NOT NULL UNIQUE, brand VARCHAR(160),
 owned_qty NUMERIC(8,0) NOT NULL DEFAULT 0 CHECK (owned_qty>=0), remarks TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by UUID REFERENCES users(user_id) ON DELETE SET NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT now(), updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS instrument_sets (
 set_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(180) NOT NULL UNIQUE, specialty VARCHAR(160),
 validity_days INTEGER NOT NULL DEFAULT 3 CHECK (validity_days>0), set_count INTEGER NOT NULL DEFAULT 1 CHECK (set_count>0), is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by UUID REFERENCES users(user_id) ON DELETE SET NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT now(), updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS instrument_set_items (
 set_id UUID NOT NULL REFERENCES instrument_sets(set_id) ON DELETE CASCADE,
 instrument_id UUID NOT NULL REFERENCES instruments(instrument_id) ON DELETE RESTRICT,
 qty NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK(qty>0), created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT now(), updated_at TIMESTAMP(3) NOT NULL DEFAULT now(), PRIMARY KEY(set_id,instrument_id)
);
CREATE TABLE IF NOT EXISTS assets (
 asset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), asset_code VARCHAR(80) NOT NULL UNIQUE, name VARCHAR(180) NOT NULL,
 category VARCHAR(20) NOT NULL CHECK(category IN ('EQUIPMENT','FURNITURE','IT','OTHER')),
 make VARCHAR(160), model VARCHAR(160), serial_no VARCHAR(160), ot_room_id UUID REFERENCES ot_rooms(ot_room_id) ON DELETE SET NULL,
 location_text TEXT, purchase_date DATE, purchase_cost NUMERIC(12,2), vendor_id UUID REFERENCES vendors(vendor_id) ON DELETE SET NULL,
 amc_vendor_id UUID REFERENCES vendors(vendor_id) ON DELETE SET NULL, amc_expiry DATE, last_service_date DATE, next_service_due DATE,
 status VARCHAR(20) NOT NULL DEFAULT 'WORKING' CHECK(status IN ('WORKING','UNDER_REPAIR','OUT_OF_ORDER','CONDEMNED')),
 remarks TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT now(), updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE OR REPLACE VIEW v_set_requirement AS
 SELECT i.instrument_id,i.name AS instrument_name,i.owned_qty,
        COALESCE(SUM(isi.qty*iset.set_count),0)::NUMERIC(12,3) AS required_qty,
        GREATEST(COALESCE(SUM(isi.qty*iset.set_count),0)-i.owned_qty,0)::NUMERIC(12,3) AS shortfall_qty
 FROM instruments i LEFT JOIN instrument_set_items isi ON isi.instrument_id=i.instrument_id
 LEFT JOIN instrument_sets iset ON iset.set_id=isi.set_id AND iset.is_active=TRUE
 GROUP BY i.instrument_id,i.name,i.owned_qty;
INSERT INTO instruments(name,brand,owned_qty) VALUES
 ('Vulsellum Standard','Surgiwear',1),('Speculum Big','Indoco',1),('Skin Grafting Blade Humby','Downs',1),('Bone Cutter Heavy','Aesculap',1)
ON CONFLICT(name) DO NOTHING;
INSERT INTO assets(asset_code,name,category,make,status) VALUES
 ('EQ-CARM10','C-Arm 10','EQUIPMENT','Medicon','WORKING'),
 ('EQ-DIATHERMY400','Diathermy 400W','EQUIPMENT','Valleylab','WORKING'),
 ('EQ-BOYLESMACHINE','Boyle''s Machine Basic','EQUIPMENT','Drager','WORKING'),
 ('EQ-OTTABLEHYD','OT Table Hydraulic','EQUIPMENT','Trumpf','WORKING'),
 ('EQ-SUCTIONPORT','Suction Apparatus Portable','EQUIPMENT','Eschmann','WORKING'),
 ('EQ-DEFIBRILLATOR','Defibrillator Biphasic','EQUIPMENT','Philips','WORKING'),
 ('EQ-PATIENTMONITOR','Patient Monitor Multipara','EQUIPMENT','Mindray','WORKING'),
 ('EQ-OTLIGHTSLED','OT Lights LED','EQUIPMENT','Mindray','WORKING')
ON CONFLICT(asset_code) DO NOTHING;
INSERT INTO instrument_sets(name,specialty) VALUES('General Instruments','General Surgery') ON CONFLICT(name) DO NOTHING;
INSERT INTO instrument_set_items(set_id,instrument_id,qty)
SELECT s.set_id,i.instrument_id,1 FROM instrument_sets s CROSS JOIN instruments i
WHERE s.name='General Instruments' AND i.name IN ('Vulsellum Standard','Speculum Big','Skin Grafting Blade Humby','Bone Cutter Heavy')
ON CONFLICT(set_id,instrument_id) DO NOTHING;
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['instruments','instrument_sets','instrument_set_items','assets'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS trg_phase1_audit_%I ON %I',t,t);
  EXECUTE format('CREATE TRIGGER trg_phase1_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_phase1_audit()',t,t);
 END LOOP;
END $$;
