/*
  # Add notion_page_id to leads table

  1. Changes
    - `leads` table: add optional `notion_page_id` text column (unique per player)
      Used to deduplicate Notion syncs — each Notion page maps to exactly one lead row.

  2. Notes
    - Column is nullable so manually-created leads (not from Notion) are unaffected.
    - Unique constraint is on (notion_page_id) only, so two players cannot clash
      (each player has their own namespace via player_id).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'notion_page_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN notion_page_id text UNIQUE;
  END IF;
END $$;
