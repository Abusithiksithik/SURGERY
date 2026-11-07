-- Item code generation: sequence is initialized above all existing ITM-#### codes.
CREATE SEQUENCE IF NOT EXISTS consumable_item_code_seq;
DO $$
DECLARE current_max BIGINT;
BEGIN
  SELECT COALESCE(MAX(substring(upper(trim(item_code)) FROM '^ITM-([0-9]+)$')::BIGINT), 0)
    INTO current_max
    FROM consumable_items
    WHERE upper(trim(item_code)) ~ '^ITM-[0-9]+$';
  PERFORM setval('consumable_item_code_seq', GREATEST(current_max, 1), current_max > 0);
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM consumable_items
    GROUP BY upper(trim(item_code)) HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_consumable_items_item_code_upper
      ON consumable_items (upper(trim(item_code)));
  END IF;
END $$;
