/*
  # Enhance District Territory System

  1. Changes to `districts` table
    - Add `xp_bonus` (integer) – bonus XP multiplier per territory level
    - Add `unlock_requirement` (integer) – player level required to unlock
    - Add `max_territory_level` (integer) – max upgradeable level per district

  2. Changes to `player_districts`
    - Add `territory_level` (integer, 1-5) – strategic progression tier
    - Add `district_reputation` (integer) – reputation earned in this district
    - Add `is_unlocked` (boolean) – whether player has unlocked this district
    - Add `opportunities_unlocked` (integer) – count of available investment slots
    - Add `dominance_xp` (integer) – XP accumulated specifically in this district
    - Add `last_quest_completed_at` (timestamptz)

  3. Important Notes
    - territory_level drives visual state: 0=locked, 1-5=progression
    - market_share maps to dominance percentage (0.0 – 1.0)
    - Opportunities unlock as territory_level increases
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'districts' AND column_name = 'xp_bonus'
  ) THEN
    ALTER TABLE districts ADD COLUMN xp_bonus integer NOT NULL DEFAULT 10;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'districts' AND column_name = 'unlock_requirement'
  ) THEN
    ALTER TABLE districts ADD COLUMN unlock_requirement integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'districts' AND column_name = 'max_territory_level'
  ) THEN
    ALTER TABLE districts ADD COLUMN max_territory_level integer NOT NULL DEFAULT 5;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_districts' AND column_name = 'territory_level'
  ) THEN
    ALTER TABLE player_districts ADD COLUMN territory_level integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_districts' AND column_name = 'district_reputation'
  ) THEN
    ALTER TABLE player_districts ADD COLUMN district_reputation integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_districts' AND column_name = 'is_unlocked'
  ) THEN
    ALTER TABLE player_districts ADD COLUMN is_unlocked boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_districts' AND column_name = 'opportunities_unlocked'
  ) THEN
    ALTER TABLE player_districts ADD COLUMN opportunities_unlocked integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_districts' AND column_name = 'dominance_xp'
  ) THEN
    ALTER TABLE player_districts ADD COLUMN dominance_xp integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_districts' AND column_name = 'last_quest_completed_at'
  ) THEN
    ALTER TABLE player_districts ADD COLUMN last_quest_completed_at timestamptz;
  END IF;
END $$;

-- Update district metadata: xp_bonus scales with difficulty, unlock_requirement gates harder districts
UPDATE districts SET
  xp_bonus = 25,
  unlock_requirement = 1,
  max_territory_level = 5
WHERE name = 'Lisboa';

UPDATE districts SET
  xp_bonus = 20,
  unlock_requirement = 1,
  max_territory_level = 5
WHERE name = 'Porto';

UPDATE districts SET
  xp_bonus = 15,
  unlock_requirement = 2,
  max_territory_level = 5
WHERE name = 'Braga';

UPDATE districts SET
  xp_bonus = 15,
  unlock_requirement = 2,
  max_territory_level = 5
WHERE name = 'Coimbra';

UPDATE districts SET
  xp_bonus = 12,
  unlock_requirement = 3,
  max_territory_level = 5
WHERE name = 'Leiria';

UPDATE districts SET
  xp_bonus = 12,
  unlock_requirement = 3,
  max_territory_level = 5
WHERE name = 'Santarém';

UPDATE districts SET
  xp_bonus = 14,
  unlock_requirement = 3,
  max_territory_level = 5
WHERE name = 'Setúbal';

UPDATE districts SET
  xp_bonus = 18,
  unlock_requirement = 4,
  max_territory_level = 5
WHERE name = 'Faro';

UPDATE districts SET
  xp_bonus = 10,
  unlock_requirement = 4,
  max_territory_level = 5
WHERE name = 'Évora';

UPDATE districts SET
  xp_bonus = 10,
  unlock_requirement = 5,
  max_territory_level = 5
WHERE name = 'Beja';

UPDATE districts SET
  xp_bonus = 30,
  unlock_requirement = 6,
  max_territory_level = 5
WHERE name = 'Madeira';

UPDATE districts SET
  xp_bonus = 30,
  unlock_requirement = 6,
  max_territory_level = 5
WHERE name = 'Açores';
