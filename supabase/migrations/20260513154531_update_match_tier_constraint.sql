/*
  # Update match_tier CHECK constraint in lead_matches

  1. Changes
    - Drops the existing CHECK constraint on `match_tier`
    - Re-adds it with two new allowed values:
      - 'budget_mismatch': investor budget cannot cover the asset price
      - 'incomplete_data': required fields missing to compute a proper match

  2. Notes
    - Uses ALTER TABLE … DROP CONSTRAINT / ADD CONSTRAINT pattern
    - Constraint name is looked up dynamically to handle any auto-generated name
*/

DO $$
DECLARE
  con_name text;
BEGIN
  -- Find the name of any check constraint on match_tier
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'lead_matches'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%match_tier%'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE lead_matches DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE lead_matches
    ADD CONSTRAINT lead_matches_match_tier_check
    CHECK (match_tier IN ('legendary','strong','warm','low','budget_mismatch','incomplete_data'));
END $$;
