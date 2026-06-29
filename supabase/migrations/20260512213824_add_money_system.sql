/*
  # Money System

  Adds three financial columns to the players table:

  1. `money` – current liquid cash balance (integer, cents precision not needed at this level, stored as integer €)
  2. `monthly_income` – advisory fee income earned per in-game month (integer €)
  3. `empire_value` – total estimated value of all assets, auto-calculated from hotels + district control (integer €)

  All default to 0 for existing rows.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'money'
  ) THEN
    ALTER TABLE players ADD COLUMN money bigint NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'monthly_income'
  ) THEN
    ALTER TABLE players ADD COLUMN monthly_income bigint NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'empire_value'
  ) THEN
    ALTER TABLE players ADD COLUMN empire_value bigint NOT NULL DEFAULT 0;
  END IF;
END $$;
