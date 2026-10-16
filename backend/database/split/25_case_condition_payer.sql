-- Sprint 1 S1-7: patient condition, ASA and payer context. Warnings are computed by API; never block save.
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS asa_grade SMALLINT CHECK (asa_grade BETWEEN 1 AND 6);
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS asa_emergency BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS comorbidities TEXT;
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS pac_date DATE;
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS pac_by_staff_id UUID REFERENCES staff(staff_id) ON DELETE SET NULL;
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS fitness_remark TEXT;
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS special_precautions TEXT;
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS planned_ot_type VARCHAR(30) CHECK (planned_ot_type IN ('Major','Minor','Cath Lab'));
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS payer_type VARCHAR(20) NOT NULL DEFAULT 'SELF' CHECK (payer_type IN ('SELF','INSURANCE','SCHEME','CORPORATE'));
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS payer_reference TEXT;
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS preauth_amount NUMERIC(12,2);
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS his_uhid TEXT;
UPDATE surgeries s SET his_uhid=p.mr_number FROM patients p WHERE p.patient_id=s.patient_id AND (s.his_uhid IS NULL OR trim(s.his_uhid)='');

CREATE OR REPLACE FUNCTION fn_set_surgery_his_uhid() RETURNS trigger AS $$
BEGIN
 IF NEW.his_uhid IS NULL OR trim(NEW.his_uhid)='' THEN
  SELECT mr_number INTO NEW.his_uhid FROM patients WHERE patient_id=NEW.patient_id;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_set_surgery_his_uhid ON surgeries;
CREATE TRIGGER trg_set_surgery_his_uhid BEFORE INSERT OR UPDATE OF patient_id,his_uhid ON surgeries FOR EACH ROW EXECUTE FUNCTION fn_set_surgery_his_uhid();
