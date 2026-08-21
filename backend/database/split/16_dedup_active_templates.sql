-- 16_dedup_active_templates.sql
-- For any procedure that has MORE than one active checklist template,
-- keep only the one with the MOST items active; deactivate all others.
-- Idempotent — safe to re-run.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Find procedures with multiple active templates
  FOR r IN
    SELECT procedure_id
    FROM preop_checklist_templates
    WHERE is_active = true
    GROUP BY procedure_id
    HAVING COUNT(*) > 1
  LOOP
    -- Deactivate all EXCEPT the template that has the most items
    -- (ties broken by created_at DESC — keep newest)
    UPDATE preop_checklist_templates
       SET is_active = false, updated_at = now()
     WHERE procedure_id = r.procedure_id
       AND is_active = true
       AND template_id NOT IN (
         SELECT t.template_id
         FROM preop_checklist_templates t
         LEFT JOIN (
           SELECT template_id, COUNT(*) AS item_count
           FROM preop_checklist_items
           GROUP BY template_id
         ) ic ON ic.template_id = t.template_id
         WHERE t.procedure_id = r.procedure_id
           AND t.is_active = true
         ORDER BY COALESCE(ic.item_count, 0) DESC, t.created_at DESC
         LIMIT 1
       );
    RAISE NOTICE 'Deduplicated active templates for procedure %', r.procedure_id;
  END LOOP;
END $$;
