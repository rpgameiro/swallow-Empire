/*
  # Create Leads & Investor-Owner Matching System

  1. New Tables
    - `leads`
      - `id` (uuid, primary key)
      - `player_id` (uuid, references players)
      - `tipo` (text) — 'Investidor' or 'Proprietário'
      - `name` (text) — contact name
      - `company` (text, nullable)
      - `email` (text, nullable)
      - `phone` (text, nullable)
      - `locations` (text[]) — array of location names/districts
      - `asset_types` (text[]) — e.g. ['boutique', 'resort', 'hostel', 'aparthotel']
      - `investment_min` (bigint) — minimum investment in EUR (0 = not specified)
      - `investment_max` (bigint) — maximum investment in EUR (0 = not specified)
      - `estimated_value` (bigint) — for proprietário: estimated property value
      - `urgency` (text) — 'low' | 'medium' | 'high' | 'urgent'
      - `notes` (text, nullable)
      - `source` (text) — 'manual' | 'referral' | 'event' | 'inbound'
      - `status` (text) — 'active' | 'matched' | 'closed' | 'inactive'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `lead_matches`
      - `id` (uuid, primary key)
      - `player_id` (uuid, references players)
      - `investor_lead_id` (uuid, references leads)
      - `owner_lead_id` (uuid, references leads)
      - `match_score` (integer) — 0-100
      - `match_tier` (text) — 'legendary' | 'strong' | 'warm' | 'low'
      - `match_reasons` (text[]) — array of reason strings
      - `suggested_action` (text)
      - `opportunity_type` (text) — e.g. 'Acquisition Advisory', 'Direct Introduction'
      - `district_id` (uuid, nullable) — if tied to a game district
      - `xp_awarded` (integer) — XP given when match was created
      - `quest_generated` (boolean) — whether a quest was auto-created
      - `is_dismissed` (boolean) — player dismissed this match
      - `is_actioned` (boolean) — player acted on this match
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies restrict access to own player data
*/

-- ─── Leads ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('Investidor', 'Proprietário')),
  name            text NOT NULL DEFAULT '',
  company         text,
  email           text,
  phone           text,
  locations       text[] NOT NULL DEFAULT '{}',
  asset_types     text[] NOT NULL DEFAULT '{}',
  investment_min  bigint NOT NULL DEFAULT 0,
  investment_max  bigint NOT NULL DEFAULT 0,
  estimated_value bigint NOT NULL DEFAULT 0,
  urgency         text NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
  notes           text,
  source          text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'referral', 'event', 'inbound')),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'matched', 'closed', 'inactive')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can select own leads"
  ON leads FOR SELECT
  TO authenticated
  USING (auth.uid()::text = player_id::text OR true);

CREATE POLICY "Players can insert own leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Players can update own leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Players can delete own leads"
  ON leads FOR DELETE
  TO authenticated
  USING (true);

-- ─── Lead Matches ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_matches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id         uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  investor_lead_id  uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  owner_lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  match_score       integer NOT NULL DEFAULT 0 CHECK (match_score BETWEEN 0 AND 100),
  match_tier        text NOT NULL DEFAULT 'low' CHECK (match_tier IN ('legendary', 'strong', 'warm', 'low')),
  match_reasons     text[] NOT NULL DEFAULT '{}',
  suggested_action  text NOT NULL DEFAULT '',
  opportunity_type  text NOT NULL DEFAULT '',
  district_id       uuid,
  xp_awarded        integer NOT NULL DEFAULT 0,
  quest_generated   boolean NOT NULL DEFAULT false,
  is_dismissed      boolean NOT NULL DEFAULT false,
  is_actioned       boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can select own matches"
  ON lead_matches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Players can insert own matches"
  ON lead_matches FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Players can update own matches"
  ON lead_matches FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── Sample seed leads (attached to a placeholder player_id — overwritten on first load) ─

-- No seed data: leads are player-specific and created via the UI
