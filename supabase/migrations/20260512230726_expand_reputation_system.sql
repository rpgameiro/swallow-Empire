/*
  # Expand Reputation System

  Adds two new reputation tracks to the player_reputation table:
  - `broker_rep` / `broker_rep_total`: Standing with hotel brokers and deal intermediaries
  - `luxury_rep` / `luxury_rep_total`: Standing in the luxury & ultra-premium market segment

  Each track follows the same current/total pattern as the existing four tracks.
  Both default to 0 and cannot be negative.

  No existing data is altered.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_reputation' AND column_name = 'broker_rep'
  ) THEN
    ALTER TABLE player_reputation
      ADD COLUMN broker_rep       integer NOT NULL DEFAULT 0,
      ADD COLUMN broker_rep_total integer NOT NULL DEFAULT 0,
      ADD COLUMN luxury_rep       integer NOT NULL DEFAULT 0,
      ADD COLUMN luxury_rep_total integer NOT NULL DEFAULT 0;
  END IF;
END $$;
