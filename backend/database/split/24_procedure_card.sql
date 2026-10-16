-- Sprint 1 S1-6: procedure preference cards.
ALTER TABLE surgery_types ADD COLUMN IF NOT EXISTS specialty VARCHAR(160);
ALTER TABLE surgery_types ADD COLUMN IF NOT EXISTS indicative_package_amount NUMERIC(12,2);
ALTER TABLE surgery_types ADD COLUMN IF NOT EXISTS typical_ot_type VARCHAR(30);
CREATE TABLE IF NOT EXISTS procedure_preference_items (
 surgery_type_id UUID NOT NULL REFERENCES surgery_types(surgery_type_id) ON DELETE CASCADE,
 item_id UUID NOT NULL REFERENCES consumable_items(item_id) ON DELETE RESTRICT,
 default_qty NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK(default_qty>0), is_optional BOOLEAN NOT NULL DEFAULT FALSE,
 sort_order INTEGER NOT NULL DEFAULT 0, created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT now(), updated_at TIMESTAMP(3) NOT NULL DEFAULT now(), PRIMARY KEY(surgery_type_id,item_id)
);
CREATE TABLE IF NOT EXISTS procedure_default_sets (
 surgery_type_id UUID NOT NULL REFERENCES surgery_types(surgery_type_id) ON DELETE CASCADE,
 set_id UUID NOT NULL REFERENCES instrument_sets(set_id) ON DELETE RESTRICT,
 created_by UUID REFERENCES users(user_id) ON DELETE SET NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT now(), updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
 PRIMARY KEY(surgery_type_id,set_id)
);
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY['procedure_preference_items','procedure_default_sets'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS trg_phase1_audit_%I ON %I',t,t);
 EXECUTE format('CREATE TRIGGER trg_phase1_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_phase1_audit()',t,t);
END LOOP; END $$;

-- Seed the ORIF-with-Nailing preference card whenever the imported item master contains matching items.
-- This is deliberately repeatable: missing items are skipped and will be picked up after the item import runs.
WITH card_items(label,match_pattern,qty,optional,sort_order) AS (VALUES
 ('RL 500ml','%RL 500ml%',1,FALSE,1),('NS 500ml','%NS 500ml%',5,FALSE,2),('NS 1000ml','%NS 1000ml%',2,FALSE,3),
 ('Anawin Heavy 4ml','%Anawin Heavy 4ml%',1,FALSE,4),('Ephedrine 2ml','%Ephedrine 2ml%',1,FALSE,5),('Distilled Water 20ml','%Distilled Water 20ml%',2,FALSE,6),
 ('Syringe 2ml','%Syringe 2ml%',2,FALSE,7),('Syringe 5ml','%Syringe 5ml%',3,FALSE,8),('Syringe 10ml','%Syringe 10ml%',5,FALSE,9),('Spinal Needle 25','%Spinal Needle 25%',1,FALSE,10),
 ('Ethilon 2-0 45mm RC 70cm','%Ethilon 2-0 45mm RC 70cm%',1,FALSE,11),('Ethilon 3-0 16mm CC 70cm','%Ethilon 3-0 16mm CC 70cm%',1,FALSE,12),('Vicryl Plus 0 40mm TP 90cm','%Vicryl Plus 0 40mm TP 90cm%',1,FALSE,13),
 ('Sterile Gloves 6.0','%Sterile Gloves 6.0%',2,FALSE,14),('Sterile Gloves 6.5','%Sterile Gloves 6.5%',2,FALSE,15),('Sterile Gloves 7.0','%Sterile Gloves 7.0%',6,FALSE,16),('Sterile Gloves 7.5','%Sterile Gloves 7.5%',2,FALSE,17),('Sterile Gloves 8.0','%Sterile Gloves 8.0%',2,FALSE,18),
 ('Surgical Blade 11','%Surgical Blade 11%',1,FALSE,19),('Surgical Blade 22','%Surgical Blade 22%',1,FALSE,20),('Romovac Set 12FG','%Romovac Set 12FG%',1,FALSE,21),
 ('Soft Roll 10cm','%Soft Roll 10cm%',3,FALSE,22),('Soft Roll 15cm','%Soft Roll 15cm%',2,FALSE,23),('Oxygen Mask Adult','%Oxygen Mask Adult%',1,FALSE,24),
 ('Plaster of Paris 15cm','%Plaster of Paris 15cm%',3,FALSE,25),('Betadine (ml)','%Betadine%ml%',100,FALSE,26)
), procedure AS (SELECT surgery_type_id FROM surgery_types WHERE lower(name)='orif with nailing' ORDER BY created_at LIMIT 1), resolved AS (
 SELECT p.surgery_type_id,ci.item_id,c.qty,c.optional,c.sort_order,
        row_number() OVER(PARTITION BY p.surgery_type_id,ci.item_id ORDER BY c.sort_order) AS rn
 FROM procedure p CROSS JOIN card_items c
 JOIN LATERAL (SELECT item_id FROM consumable_items WHERE item_name ILIKE c.match_pattern ORDER BY item_name LIMIT 1) ci ON TRUE
)
INSERT INTO procedure_preference_items(surgery_type_id,item_id,default_qty,is_optional,sort_order)
SELECT surgery_type_id,item_id,qty,optional,sort_order FROM resolved WHERE rn=1
ON CONFLICT(surgery_type_id,item_id) DO NOTHING;
