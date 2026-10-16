-- =====================================================================
-- 06_seed.sql
-- Comprehensive seed: branch, departments, surgeons, anaesthetists,
-- patients, surgery types, OT rooms, completed surgeries (for dashboard,
-- benchmarks, recommendations, explorer), and alert thresholds.
-- All inserts are idempotent (ON CONFLICT / WHERE NOT EXISTS).
-- =====================================================================

-- ── Extensions must already be loaded (01_extensions.sql) ────────────
-- ── Enums already created (02_enums.sql) ─────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- BRANCH
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO branches (branch_id, branch_code, branch_name, city)
VALUES ('00000000-0000-0000-0000-000000000001','MAIN','Main Hospital','Madurai')
ON CONFLICT (branch_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- DEPARTMENTS
-- ─────────────────────────────────────────────────────────────────────
-- The Node.js fallback may already have created GEN under a different UUID.
-- Keep that existing department; add ORTHO/CARDIO only when their codes are absent.
INSERT INTO departments (department_id, branch_id, department_code, department_name)
SELECT v.department_id, v.branch_id, v.department_code, v.department_name
FROM (VALUES
  ('00000000-0000-0000-0000-000000000010'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'GEN','General Surgery'),
  ('00000000-0000-0000-0000-000000000011'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'ORTHO','Orthopaedics'),
  ('00000000-0000-0000-0000-000000000012'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'CARDIO','Cardiology')
) AS v(department_id, branch_id, department_code, department_name)
WHERE NOT EXISTS (
  SELECT 1 FROM departments d
  WHERE d.branch_id = v.branch_id
    AND d.department_code = v.department_code
)
ON CONFLICT (branch_id, department_code) DO NOTHING;

-- Admin credentials are initialized by initializeDatabase.js from validated environment settings.

-- ─────────────────────────────────────────────────────────────────────
-- SURGEONS
-- ─────────────────────────────────────────────────────────────────────
-- department_id for GEN surgeons uses a sub-select so it works whether
-- GEN was seeded as ...0002 (Node.js fallback) or ...0010 (SQL seed).
INSERT INTO surgeons (surgeon_id, branch_id, department_id, employee_code, full_name, specialization)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000020'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,(SELECT department_id FROM departments WHERE branch_id='00000000-0000-0000-0000-000000000001' AND department_code='GEN' LIMIT 1),'S001','Dr. Arun Kumar','General Surgeon'),
  ('00000000-0000-0000-0000-000000000021'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,(SELECT department_id FROM departments WHERE branch_id='00000000-0000-0000-0000-000000000001' AND department_code='GEN' LIMIT 1),'S002','Dr. Priya Nair','Laparoscopic Surgeon'),
  ('00000000-0000-0000-0000-000000000022'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,(SELECT department_id FROM departments WHERE branch_id='00000000-0000-0000-0000-000000000001' AND department_code='ORTHO' LIMIT 1),'S003','Dr. Ramesh Babu','Orthopaedic Surgeon'),
  ('00000000-0000-0000-0000-000000000023'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,(SELECT department_id FROM departments WHERE branch_id='00000000-0000-0000-0000-000000000001' AND department_code='CARDIO' LIMIT 1),'S004','Dr. Meena Sundaram','Cardiothoracic Surgeon')
) AS v(surgeon_id, branch_id, department_id, employee_code, full_name, specialization)
ON CONFLICT (employee_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- ANAESTHETISTS
-- ─────────────────────────────────────────────────────────────────────
-- Qualification is optional; migration 19 adds it to legacy databases that lack it.
INSERT INTO anaesthetists (anaesthetist_id, branch_id, employee_code, full_name)
VALUES
  ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000001','A001','Dr. Kavitha Mohan'),
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000001','A002','Dr. Senthil Raj')
ON CONFLICT (employee_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- ASSISTANTS
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO assistants (assistant_id, branch_id, employee_code, full_name, role_title)
VALUES
  ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000001','AS001','Nurse Lakshmi','Scrub Nurse'),
  ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000001','AS002','Nurse Anitha','Circulating Nurse')
ON CONFLICT (employee_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- SURGERY TYPES
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO surgery_types (surgery_type_id, department_id, code, name, package_name)
SELECT v.surgery_type_id, d.department_id, v.code, v.name, v.package_name
FROM (VALUES
  ('00000000-0000-0000-0000-000000000050'::uuid,'GEN','APPY','Appendicectomy','General Package A'),
  ('00000000-0000-0000-0000-000000000051'::uuid,'GEN','CHOLE','Laparoscopic Cholecystectomy','General Package B'),
  ('00000000-0000-0000-0000-000000000052'::uuid,'ORTHO','TKR','Total Knee Replacement','Ortho Package A'),
  ('00000000-0000-0000-0000-000000000053'::uuid,'CARDIO','CABG','Coronary Artery Bypass Graft','Cardio Package A'),
  ('00000000-0000-0000-0000-000000000054'::uuid,'GEN','HERN','Hernia Repair','General Package C')
) AS v(surgery_type_id, department_code, code, name, package_name)
JOIN departments d
  ON d.department_code = v.department_code
 AND d.branch_id = '00000000-0000-0000-0000-000000000001'::uuid
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- OT ROOMS
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO ot_rooms (ot_room_id, branch_id, room_code, room_name, cost_per_minute)
VALUES
  ('00000000-0000-0000-0000-000000000060','00000000-0000-0000-0000-000000000001','OT1','OT Room 1',25.00),
  ('00000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000001','OT2','OT Room 2',30.00)
ON CONFLICT (branch_id, room_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- PATIENTS
-- ─────────────────────────────────────────────────────────────────────
-- Only 3 active sample patients shown in UI; MR004–MR008 are kept for
-- historical surgery data integrity but deactivated so they don't clutter
-- the patient dropdown.
INSERT INTO patients (patient_id, branch_id, mr_number, full_name, date_of_birth, gender, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000001','MR001','Murugesan K','1972-05-14','MALE',TRUE),
  ('00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000001','MR002','Saraswathi D','1968-11-23','FEMALE',TRUE),
  ('00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-000000000001','MR003','Karthik R','1985-03-09','MALE',TRUE),
  ('00000000-0000-0000-0000-000000000073','00000000-0000-0000-0000-000000000001','MR004','Deepa M','1990-07-17','FEMALE',FALSE),
  ('00000000-0000-0000-0000-000000000074','00000000-0000-0000-0000-000000000001','MR005','Vijay S','1959-12-01','MALE',FALSE),
  ('00000000-0000-0000-0000-000000000075','00000000-0000-0000-0000-000000000001','MR006','Anitha P','1978-04-30','FEMALE',FALSE),
  ('00000000-0000-0000-0000-000000000076','00000000-0000-0000-0000-000000000001','MR007','Suresh Kumar','1963-08-22','MALE',FALSE),
  ('00000000-0000-0000-0000-000000000077','00000000-0000-0000-0000-000000000001','MR008','Parvathi N','1995-01-15','FEMALE',FALSE)
ON CONFLICT (branch_id, mr_number) WHERE (is_active = true) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- CONSUMABLE ITEMS
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO consumable_items (item_id, item_code, item_name, unit, standard_cost)
VALUES
  ('00000000-0000-0000-0000-000000000080','C001','Surgical Gloves (pair)','pair',45.00),
  ('00000000-0000-0000-0000-000000000081','C002','Sutures (box)','box',320.00),
  ('00000000-0000-0000-0000-000000000082','C003','Surgical Drape','piece',180.00),
  ('00000000-0000-0000-0000-000000000083','C004','Trocar 5mm','piece',850.00),
  ('00000000-0000-0000-0000-000000000084','C005','Electrocautery Pen','piece',1200.00)
ON CONFLICT (item_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- PHARMACY ITEMS
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO pharmacy_items (pharmacy_item_id, item_code, item_name, unit, standard_cost)
VALUES
  ('00000000-0000-0000-0000-000000000090','P001','Propofol 200mg/20ml','vial',380.00),
  ('00000000-0000-0000-0000-000000000091','P002','Midazolam 5mg/5ml','vial',125.00),
  ('00000000-0000-0000-0000-000000000092','P003','Fentanyl 100mcg/2ml','ampoule',95.00),
  ('00000000-0000-0000-0000-000000000093','P004','Cefazolin 1g','vial',210.00)
ON CONFLICT (item_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- COMPLETED SURGERIES (historical data for dashboard / benchmarks /
-- recommendation engine / similar surgery explorer)
-- Note: age_group labels in v_completed_surgeries use the SQL CASE
-- ('CHILD','YOUNG_ADULT','ADULT','MIDDLE_AGED','SENIOR') — the
-- similarity engine's ageToGroup() was updated to match these labels.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  -- Re-usable IDs
  bid   UUID := '00000000-0000-0000-0000-000000000001';  -- branch MAIN
  dep1  UUID;
  dep2  UUID;
  dep3  UUID;
  surg1 UUID := '00000000-0000-0000-0000-000000000020';  -- Dr. Arun Kumar
  surg2 UUID := '00000000-0000-0000-0000-000000000021';  -- Dr. Priya Nair
  surg3 UUID := '00000000-0000-0000-0000-000000000022';  -- Dr. Ramesh Babu
  surg4 UUID := '00000000-0000-0000-0000-000000000023';  -- Dr. Meena Sundaram
  anaes1 UUID := '00000000-0000-0000-0000-000000000030'; -- Dr. Kavitha Mohan
  anaes2 UUID := '00000000-0000-0000-0000-000000000031'; -- Dr. Senthil Raj
  pat1  UUID := '00000000-0000-0000-0000-000000000070';
  pat2  UUID := '00000000-0000-0000-0000-000000000071';
  pat3  UUID := '00000000-0000-0000-0000-000000000072';
  pat4  UUID := '00000000-0000-0000-0000-000000000073';
  pat5  UUID := '00000000-0000-0000-0000-000000000074';
  pat6  UUID := '00000000-0000-0000-0000-000000000075';
  pat7  UUID := '00000000-0000-0000-0000-000000000076';
  pat8  UUID := '00000000-0000-0000-0000-000000000077';
  stype_appy  UUID := '00000000-0000-0000-0000-000000000050';
  stype_chole UUID := '00000000-0000-0000-0000-000000000051';
  stype_tkr   UUID := '00000000-0000-0000-0000-000000000052';
  stype_cabg  UUID := '00000000-0000-0000-0000-000000000053';
  stype_hern  UUID := '00000000-0000-0000-0000-000000000054';
  ot1   UUID := '00000000-0000-0000-0000-000000000060';
  ot2   UUID := '00000000-0000-0000-0000-000000000061';

  sid   UUID;
BEGIN
  SELECT department_id INTO dep1 FROM departments WHERE branch_id=bid AND department_code='GEN' LIMIT 1;
  SELECT department_id INTO dep2 FROM departments WHERE branch_id=bid AND department_code='ORTHO' LIMIT 1;
  SELECT department_id INTO dep3 FROM departments WHERE branch_id=bid AND department_code='CARDIO' LIMIT 1;

  IF dep1 IS NULL OR dep2 IS NULL OR dep3 IS NULL THEN
    RAISE EXCEPTION 'Required seed departments are missing (GEN, ORTHO, CARDIO)';
  END IF;

  -- Surgery 1: Appendicectomy by Dr. Arun Kumar, 3 months ago
  IF NOT EXISTS (SELECT 1 FROM surgeries WHERE surgery_id = '11000000-0000-0000-0000-000000000001') THEN
    sid := '11000000-0000-0000-0000-000000000001'::UUID;
    INSERT INTO surgeries (
      surgery_id, branch_id, department_id, patient_id, surgeon_id, anaesthetist_id,
      surgery_type_id, ot_room_id, status, patient_age_years, patient_gender,
      anaesthesia_type, surgery_date, ot_in_time, ot_out_time,
      budget_surgeon_fee, budget_anaesthetist_fee, budget_ot_cost, budget_consumables, budget_pharmacy, budget_miscellaneous,
      actual_surgeon_fee, actual_anaesthetist_fee, actual_ot_cost, actual_consumables, actual_pharmacy, actual_miscellaneous,
      quoted_price, collected_amount, is_outlier
    ) VALUES (
      sid, bid, dep1, pat1, surg1, anaes1,
      stype_appy, ot1, 'COMPLETED', 52, 'MALE',
      'Spinal', (now() - interval '90 days')::date,
      (now() - interval '90 days')::date + time '09:00',
      (now() - interval '90 days')::date + time '10:45',
      18000, 8000, 6500, 3500, 2000, 1500,
      18000, 8000, 7000, 3200, 1800, 1200,
      65000, 65000, FALSE
    );
  END IF;

  -- Surgery 2: Laparoscopic Cholecystectomy by Dr. Priya Nair, 2.5 months ago
  IF NOT EXISTS (SELECT 1 FROM surgeries WHERE surgery_id = '11000000-0000-0000-0000-000000000002') THEN
    sid := '11000000-0000-0000-0000-000000000002'::UUID;
    INSERT INTO surgeries (
      surgery_id, branch_id, department_id, patient_id, surgeon_id, anaesthetist_id,
      surgery_type_id, ot_room_id, status, patient_age_years, patient_gender,
      anaesthesia_type, surgery_date, ot_in_time, ot_out_time,
      budget_surgeon_fee, budget_anaesthetist_fee, budget_ot_cost, budget_consumables, budget_pharmacy, budget_miscellaneous,
      actual_surgeon_fee, actual_anaesthetist_fee, actual_ot_cost, actual_consumables, actual_pharmacy, actual_miscellaneous,
      quoted_price, collected_amount, is_outlier
    ) VALUES (
      sid, bid, dep1, pat2, surg2, anaes2,
      stype_chole, ot2, 'COMPLETED', 56, 'FEMALE',
      'General', (now() - interval '75 days')::date,
      (now() - interval '75 days')::date + time '11:00',
      (now() - interval '75 days')::date + time '13:00',
      22000, 9000, 8000, 4500, 2500, 1000,
      22000, 9000, 8500, 4200, 2400, 900,
      75000, 70000, FALSE
    );
  END IF;

  -- Surgery 3: Total Knee Replacement by Dr. Ramesh Babu, 2 months ago
  IF NOT EXISTS (SELECT 1 FROM surgeries WHERE surgery_id = '11000000-0000-0000-0000-000000000003') THEN
    sid := '11000000-0000-0000-0000-000000000003'::UUID;
    INSERT INTO surgeries (
      surgery_id, branch_id, department_id, patient_id, surgeon_id, anaesthetist_id,
      surgery_type_id, ot_room_id, status, patient_age_years, patient_gender,
      anaesthesia_type, surgery_date, ot_in_time, ot_out_time,
      budget_surgeon_fee, budget_anaesthetist_fee, budget_ot_cost, budget_consumables, budget_pharmacy, budget_miscellaneous,
      actual_surgeon_fee, actual_anaesthetist_fee, actual_ot_cost, actual_consumables, actual_pharmacy, actual_miscellaneous,
      quoted_price, collected_amount, is_outlier
    ) VALUES (
      sid, bid, dep2, pat3, surg3, anaes1,
      stype_tkr, ot1, 'COMPLETED', 39, 'MALE',
      'Spinal', (now() - interval '60 days')::date,
      (now() - interval '60 days')::date + time '08:30',
      (now() - interval '60 days')::date + time '11:30',
      35000, 12000, 11250, 18000, 5000, 3000,
      35000, 12000, 11500, 17500, 4800, 2800,
      120000, 120000, FALSE
    );
  END IF;

  -- Surgery 4: Hernia Repair by Dr. Arun Kumar, 45 days ago
  IF NOT EXISTS (SELECT 1 FROM surgeries WHERE surgery_id = '11000000-0000-0000-0000-000000000004') THEN
    sid := '11000000-0000-0000-0000-000000000004'::UUID;
    INSERT INTO surgeries (
      surgery_id, branch_id, department_id, patient_id, surgeon_id, anaesthetist_id,
      surgery_type_id, ot_room_id, status, patient_age_years, patient_gender,
      anaesthesia_type, surgery_date, ot_in_time, ot_out_time,
      budget_surgeon_fee, budget_anaesthetist_fee, budget_ot_cost, budget_consumables, budget_pharmacy, budget_miscellaneous,
      actual_surgeon_fee, actual_anaesthetist_fee, actual_ot_cost, actual_consumables, actual_pharmacy, actual_miscellaneous,
      quoted_price, collected_amount, is_outlier
    ) VALUES (
      sid, bid, dep1, pat4, surg1, anaes2,
      stype_hern, ot1, 'COMPLETED', 32, 'FEMALE',
      'Local', (now() - interval '45 days')::date,
      (now() - interval '45 days')::date + time '14:00',
      (now() - interval '45 days')::date + time '15:30',
      14000, 6000, 4500, 2000, 1500, 800,
      14000, 6000, 4800, 2100, 1400, 700,
      50000, 45000, FALSE
    );
  END IF;

  -- Surgery 5: Appendicectomy by Dr. Arun Kumar (different patient), 30 days ago
  IF NOT EXISTS (SELECT 1 FROM surgeries WHERE surgery_id = '11000000-0000-0000-0000-000000000005') THEN
    sid := '11000000-0000-0000-0000-000000000005'::UUID;
    INSERT INTO surgeries (
      surgery_id, branch_id, department_id, patient_id, surgeon_id, anaesthetist_id,
      surgery_type_id, ot_room_id, status, patient_age_years, patient_gender,
      anaesthesia_type, surgery_date, ot_in_time, ot_out_time,
      budget_surgeon_fee, budget_anaesthetist_fee, budget_ot_cost, budget_consumables, budget_pharmacy, budget_miscellaneous,
      actual_surgeon_fee, actual_anaesthetist_fee, actual_ot_cost, actual_consumables, actual_pharmacy, actual_miscellaneous,
      quoted_price, collected_amount, is_outlier
    ) VALUES (
      sid, bid, dep1, pat5, surg1, anaes1,
      stype_appy, ot2, 'COMPLETED', 65, 'MALE',
      'General', (now() - interval '30 days')::date,
      (now() - interval '30 days')::date + time '10:00',
      (now() - interval '30 days')::date + time '11:50',
      19000, 8500, 7500, 3800, 2200, 1200,
      19000, 8500, 7800, 3600, 2000, 1100,
      70000, 70000, FALSE
    );
  END IF;

  -- Surgery 6: Laparoscopic Cholecystectomy by Dr. Priya Nair, 20 days ago
  IF NOT EXISTS (SELECT 1 FROM surgeries WHERE surgery_id = '11000000-0000-0000-0000-000000000006') THEN
    sid := '11000000-0000-0000-0000-000000000006'::UUID;
    INSERT INTO surgeries (
      surgery_id, branch_id, department_id, patient_id, surgeon_id, anaesthetist_id,
      surgery_type_id, ot_room_id, status, patient_age_years, patient_gender,
      anaesthesia_type, surgery_date, ot_in_time, ot_out_time,
      budget_surgeon_fee, budget_anaesthetist_fee, budget_ot_cost, budget_consumables, budget_pharmacy, budget_miscellaneous,
      actual_surgeon_fee, actual_anaesthetist_fee, actual_ot_cost, actual_consumables, actual_pharmacy, actual_miscellaneous,
      quoted_price, collected_amount, is_outlier
    ) VALUES (
      sid, bid, dep1, pat6, surg2, anaes2,
      stype_chole, ot1, 'COMPLETED', 45, 'FEMALE',
      'General', (now() - interval '20 days')::date,
      (now() - interval '20 days')::date + time '09:30',
      (now() - interval '20 days')::date + time '11:45',
      23000, 9500, 9375, 4800, 2600, 1000,
      23000, 9500, 9600, 4500, 2500, 950,
      80000, 80000, FALSE
    );
  END IF;

  -- Surgery 7: Total Knee Replacement by Dr. Ramesh Babu, 15 days ago
  IF NOT EXISTS (SELECT 1 FROM surgeries WHERE surgery_id = '11000000-0000-0000-0000-000000000007') THEN
    sid := '11000000-0000-0000-0000-000000000007'::UUID;
    INSERT INTO surgeries (
      surgery_id, branch_id, department_id, patient_id, surgeon_id, anaesthetist_id,
      surgery_type_id, ot_room_id, status, patient_age_years, patient_gender,
      anaesthesia_type, surgery_date, ot_in_time, ot_out_time,
      budget_surgeon_fee, budget_anaesthetist_fee, budget_ot_cost, budget_consumables, budget_pharmacy, budget_miscellaneous,
      actual_surgeon_fee, actual_anaesthetist_fee, actual_ot_cost, actual_consumables, actual_pharmacy, actual_miscellaneous,
      quoted_price, collected_amount, is_outlier
    ) VALUES (
      sid, bid, dep2, pat7, surg3, anaes1,
      stype_tkr, ot2, 'COMPLETED', 60, 'MALE',
      'Spinal', (now() - interval '15 days')::date,
      (now() - interval '15 days')::date + time '07:30',
      (now() - interval '15 days')::date + time '10:00',
      36000, 12500, 11250, 19000, 5200, 2500,
      36000, 12500, 12000, 18800, 5100, 2400,
      125000, 100000, FALSE
    );
  END IF;

  -- Surgery 8: Hernia Repair by Dr. Arun Kumar, 7 days ago
  IF NOT EXISTS (SELECT 1 FROM surgeries WHERE surgery_id = '11000000-0000-0000-0000-000000000008') THEN
    sid := '11000000-0000-0000-0000-000000000008'::UUID;
    INSERT INTO surgeries (
      surgery_id, branch_id, department_id, patient_id, surgeon_id, anaesthetist_id,
      surgery_type_id, ot_room_id, status, patient_age_years, patient_gender,
      anaesthesia_type, surgery_date, ot_in_time, ot_out_time,
      budget_surgeon_fee, budget_anaesthetist_fee, budget_ot_cost, budget_consumables, budget_pharmacy, budget_miscellaneous,
      actual_surgeon_fee, actual_anaesthetist_fee, actual_ot_cost, actual_consumables, actual_pharmacy, actual_miscellaneous,
      quoted_price, collected_amount, is_outlier
    ) VALUES (
      sid, bid, dep1, pat8, surg1, anaes2,
      stype_hern, ot1, 'COMPLETED', 27, 'FEMALE',
      'Spinal', (now() - interval '7 days')::date,
      (now() - interval '7 days')::date + time '11:30',
      (now() - interval '7 days')::date + time '13:00',
      15000, 6500, 4500, 2200, 1600, 900,
      15500, 6500, 4500, 2000, 1500, 800,
      52000, 52000, FALSE
    );
  END IF;

  -- Surgery 9: Draft surgery (for Surgery Budgets list testing)
  IF NOT EXISTS (SELECT 1 FROM surgeries WHERE surgery_id = '11000000-0000-0000-0000-000000000009') THEN
    INSERT INTO surgeries (
      surgery_id, branch_id, department_id, patient_id, surgeon_id, anaesthetist_id,
      surgery_type_id, status, patient_age_years, patient_gender,
      scheduled_date,
      budget_surgeon_fee, budget_anaesthetist_fee, budget_ot_cost, budget_consumables, budget_pharmacy, budget_miscellaneous,
      quoted_price, collected_amount, is_outlier
    ) VALUES (
      '11000000-0000-0000-0000-000000000009'::UUID,
      bid, dep1, pat1, surg2, anaes1,
      stype_chole, 'DRAFT', 52, 'MALE',
      (now() + interval '7 days')::date,
      22000, 9000, 8000, 4500, 2500, 1000,
      75000, 0, FALSE
    );
  END IF;

END $$;

-- ─────────────────────────────────────────────────────────────────────
-- SURGERY CONSUMABLES for completed surgeries
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM surgery_consumables WHERE surgery_id = '11000000-0000-0000-0000-000000000001') THEN
    INSERT INTO surgery_consumables (surgery_id, item_id, quantity, unit_cost)
    VALUES
      ('11000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000080',4,45),
      ('11000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000081',2,320),
      ('11000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000082',3,180);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM surgery_consumables WHERE surgery_id = '11000000-0000-0000-0000-000000000002') THEN
    INSERT INTO surgery_consumables (surgery_id, item_id, quantity, unit_cost)
    VALUES
      ('11000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000083',2,850),
      ('11000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000084',1,1200),
      ('11000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000080',4,45);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM surgery_consumables WHERE surgery_id = '11000000-0000-0000-0000-000000000005') THEN
    INSERT INTO surgery_consumables (surgery_id, item_id, quantity, unit_cost)
    VALUES
      ('11000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000080',4,45),
      ('11000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000081',2,320);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- REFRESH materialized views (so dashboard / benchmarks have data)
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Only refresh if the view has data (it was populated above)
  IF EXISTS (SELECT 1 FROM v_completed_surgeries LIMIT 1) THEN
    REFRESH MATERIALIZED VIEW mv_surgeon_stats;
    REFRESH MATERIALIZED VIEW mv_surgery_type_stats;
    REFRESH MATERIALIZED VIEW mv_anaesthetist_stats;
    REFRESH MATERIALIZED VIEW mv_ot_stats;
    REFRESH MATERIALIZED VIEW mv_monthly_financials;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- ALERT THRESHOLDS
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    threshold_data TEXT[][] := ARRAY[
        ARRAY['SURGEON_FEE_HIGH',    '10', '25'],
        ARRAY['ASSISTANT_COST_HIGH', '10', '25'],
        ARRAY['OT_DURATION_LONG',    '15', '30'],
        ARRAY['OT_COST_HIGH',        '10', '25'],
        ARRAY['CONSUMABLES_HIGH',    '10', '25'],
        ARRAY['MARGIN_BELOW_TARGET', '10', '25'],
        ARRAY['QUOTE_TOO_LOW',       '10', '25'],
        ARRAY['NEGATIVE_PROFIT',      '0',  '0'],
        ARRAY['BUDGET_EXCEEDED',     '10', '25'],
        ARRAY['COLLECTION_PENDING',  '10', '25']
    ];
    rec TEXT[];
BEGIN
    FOREACH rec SLICE 1 IN ARRAY threshold_data LOOP
        IF NOT EXISTS (
            SELECT 1 FROM alert_thresholds
            WHERE branch_id IS NULL AND alert_type = rec[1]::alert_type
        ) THEN
            INSERT INTO alert_thresholds (branch_id, alert_type, yellow_threshold_pct, red_threshold_pct)
            VALUES (NULL, rec[1]::alert_type, rec[2]::NUMERIC, rec[3]::NUMERIC);
        END IF;
    END LOOP;
END $$;
