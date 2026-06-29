/*
  # Add source and accepted_at to dynamic_quests

  1. Changes
    - `dynamic_quests` table:
      - `source` text — origin of the quest (e.g. 'generated', 'ai_mission', 'match_engine')
      - `accepted_at` timestamptz — when the player explicitly accepted this mission (null for auto-generated quests)

  2. Notes
    - Both columns are nullable and default to null so existing rows are unaffected.
    - AI-mission-derived quests will have source='ai_mission' and accepted_at set to the time the
      player clicked "Accept Mission".
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dynamic_quests' AND column_name = 'source'
  ) THEN
    ALTER TABLE dynamic_quests ADD COLUMN source text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dynamic_quests' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE dynamic_quests ADD COLUMN accepted_at timestamptz;
  END IF;
END $$;
