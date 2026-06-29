/*
  # Add money_reward to dynamic_quests

  Adds a `money_reward` column (integer €) to the dynamic_quests table.
  Defaults to 0 for all existing rows.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dynamic_quests' AND column_name = 'money_reward'
  ) THEN
    ALTER TABLE dynamic_quests ADD COLUMN money_reward integer NOT NULL DEFAULT 0;
  END IF;
END $$;
