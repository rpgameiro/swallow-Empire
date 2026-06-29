/*
  # Add Player Energy System

  ## Summary
  Adds four new RPG-style vitality stats to the players table:
  - energy: Current energy (0-100), consumed by calls/meetings, restored by rest/deals
  - max_energy: Maximum energy capacity (starts at 100, increases with discipline)
  - stress: Stress level (0-100), increased by trading and failures, reduced by rest
  - morale: Morale/confidence (0-100), boosted by successful deals and routines

  These four columns join the existing focus and discipline stats to form a complete
  RPG character vitality panel.

  ## Changes
  - `players` table: Add energy, max_energy, stress, morale columns with sensible defaults
  - All new columns default to values representing a healthy, starting advisor
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'energy'
  ) THEN
    ALTER TABLE players ADD COLUMN energy integer NOT NULL DEFAULT 80;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'max_energy'
  ) THEN
    ALTER TABLE players ADD COLUMN max_energy integer NOT NULL DEFAULT 100;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'stress'
  ) THEN
    ALTER TABLE players ADD COLUMN stress integer NOT NULL DEFAULT 20;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'morale'
  ) THEN
    ALTER TABLE players ADD COLUMN morale integer NOT NULL DEFAULT 75;
  END IF;
END $$;
