/*
  # Add Snooze Functionality to AI Suggestions

  ## Summary
  Extends the ai_suggestions table to support a "snoozed" state where a
  suggestion is hidden temporarily and reappears at a player-chosen future time.

  ## Changes
  1. Modified Tables
     - `ai_suggestions`
       - `status` CHECK constraint updated to include 'snoozed'
       - New column `snoozed_until` (timestamptz, nullable) — when to resurface

  ## Notes
  - Snoozed suggestions are excluded from the active pending query until
    their snoozed_until timestamp has passed, at which point getAISuggestions
    treats them as pending again.
  - The client-side expiry logic also runs on snoozed suggestions.
*/

-- Add snoozed_until column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_suggestions' AND column_name = 'snoozed_until'
  ) THEN
    ALTER TABLE ai_suggestions ADD COLUMN snoozed_until timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Drop old status constraint and replace with one that includes 'snoozed'
ALTER TABLE ai_suggestions DROP CONSTRAINT IF EXISTS ai_suggestions_status_check;
ALTER TABLE ai_suggestions
  ADD CONSTRAINT ai_suggestions_status_check
  CHECK (status IN ('pending', 'accepted', 'dismissed', 'expired', 'snoozed'));

-- Index to efficiently query snoozed suggestions that have woken up
CREATE INDEX IF NOT EXISTS ai_suggestions_snooze_wake_idx
  ON ai_suggestions(player_id, snoozed_until)
  WHERE status = 'snoozed';
