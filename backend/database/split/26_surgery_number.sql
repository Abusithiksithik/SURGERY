-- Sprint 1 S1-8: immutable, database-generated daily surgery number.
CREATE TABLE IF NOT EXISTS surgery_number_counters (
 surgery_date DATE PRIMARY KEY, last_value INTEGER NOT NULL DEFAULT 0 CHECK(last_value>=0),
 created_by UUID REFERENCES users(user_id) ON DELETE SET NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT now(), updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS surgery_number VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS uq_surgeries_surgery_number ON surgeries(surgery_number) WHERE surgery_number IS NOT NULL;
CREATE OR REPLACE FUNCTION fn_assign_surgery_number() RETURNS trigger AS $$
DECLARE d DATE; n INTEGER;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.surgery_number IS NOT NULL AND NEW.surgery_number IS DISTINCT FROM OLD.surgery_number THEN
   RAISE EXCEPTION 'surgery_number is immutable and cannot be changed';
  END IF;
  IF OLD.surgery_number IS NOT NULL THEN NEW.surgery_number:=OLD.surgery_number; RETURN NEW; END IF;
 END IF;
 IF NEW.surgery_number IS NULL OR trim(NEW.surgery_number)='' THEN
  d:=COALESCE(NEW.surgery_date,NEW.scheduled_date,NEW.created_at::date,CURRENT_DATE);
  INSERT INTO surgery_number_counters(surgery_date,last_value) VALUES(d,1)
  ON CONFLICT(surgery_date) DO UPDATE SET last_value=surgery_number_counters.last_value+1,updated_at=now()
  RETURNING last_value INTO n;
  NEW.surgery_number:='SUR-'||to_char(d,'YYYYMMDD')||'-'||lpad(n::text,4,'0');
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DO $$ DECLARE r RECORD; d DATE; n INTEGER; BEGIN
 FOR r IN SELECT surgery_id,COALESCE(surgery_date,scheduled_date,created_at::date,CURRENT_DATE) AS d FROM surgeries WHERE surgery_number IS NULL OR trim(surgery_number)='' OR surgery_number !~ '^SUR-[0-9]{8}-[0-9]{4}$' ORDER BY COALESCE(surgery_date,scheduled_date,created_at::date),created_at,surgery_id LOOP
  d:=r.d;
  INSERT INTO surgery_number_counters(surgery_date,last_value) VALUES(d,1)
  ON CONFLICT(surgery_date) DO UPDATE SET last_value=surgery_number_counters.last_value+1,updated_at=now() RETURNING last_value INTO n;
  UPDATE surgeries SET surgery_number='SUR-'||to_char(d,'YYYYMMDD')||'-'||lpad(n::text,4,'0') WHERE surgery_id=r.surgery_id;
 END LOOP;
END $$;
UPDATE surgery_schedules ss SET surgery_number=s.surgery_number FROM surgeries s WHERE ss.surgery_id=s.surgery_id AND ss.surgery_number IS DISTINCT FROM s.surgery_number;
DROP TRIGGER IF EXISTS trg_assign_surgery_number ON surgeries;
CREATE TRIGGER trg_assign_surgery_number BEFORE INSERT OR UPDATE OF surgery_number ON surgeries FOR EACH ROW EXECUTE FUNCTION fn_assign_surgery_number();
DO $$ BEGIN
 DROP TRIGGER IF EXISTS trg_phase1_audit_surgery_number_counters ON surgery_number_counters;
 CREATE TRIGGER trg_phase1_audit_surgery_number_counters AFTER INSERT OR UPDATE OR DELETE ON surgery_number_counters FOR EACH ROW EXECUTE FUNCTION fn_phase1_audit();
END $$;
