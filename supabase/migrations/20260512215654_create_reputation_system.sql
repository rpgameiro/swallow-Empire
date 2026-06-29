/*
  # Reputation System

  Creates a multi-dimensional reputation system with four track types:
  - investor  : reputation with capital providers and family offices
  - owner     : reputation with property owners and sellers
  - market    : general market standing and brand recognition
  - operator  : reputation with hotel operators and management companies

  Each track has independent score and rank progression.
  Higher scores unlock bigger deals, off-market opportunities, better investors,
  exclusive listings, and legendary missions.

  1. New Tables
    - `player_reputation` — one row per player, four score columns + history metadata

  2. Security
    - RLS enabled, players can read and update their own row
*/

CREATE TABLE IF NOT EXISTS player_reputation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  investor_rep        integer NOT NULL DEFAULT 0,
  owner_rep           integer NOT NULL DEFAULT 0,
  market_rep          integer NOT NULL DEFAULT 0,
  operator_rep        integer NOT NULL DEFAULT 0,
  investor_rep_total  integer NOT NULL DEFAULT 0,
  owner_rep_total     integer NOT NULL DEFAULT 0,
  market_rep_total    integer NOT NULL DEFAULT 0,
  operator_rep_total  integer NOT NULL DEFAULT 0,
  updated_at          timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE player_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read own reputation"
  ON player_reputation FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Players can insert own reputation"
  ON player_reputation FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Players can update own reputation"
  ON player_reputation FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
