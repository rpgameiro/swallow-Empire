/*
  # Rival System

  ## Summary
  Creates the competing firms and broker rival system for Swallow Empire.
  Rivals are AI-controlled advisory firms that compete with the player for
  territories, investors, and hotel deals. The system tracks market share
  conflicts, reputation battles, and lost opportunities.

  ## New Tables

  ### `rival_firms`
  Defines each competing firm: name, style, aggression level, focus districts.

  Columns:
  - id (uuid, pk)
  - slug (text, unique)
  - name (text) — Firm display name
  - tagline (text) — Short descriptor
  - type (text) — 'firm' | 'broker' | 'boutique' | 'international'
  - aggression (integer 1-10) — How aggressively they expand
  - reputation_score (integer 0-100) — Their current market standing
  - market_focus (text) — 'lisbon' | 'north' | 'algarve' | 'national' | 'premium'
  - accent_color (text) — Hex color for UI
  - founder_name (text) — Key person at the firm
  - bio (text) — Background flavor text
  - specialisation (text) — What deal type they focus on
  - is_active (boolean)
  - created_at (timestamptz)

  ### `rival_district_presence`
  Tracks each rival's presence in each district — mirrors player_districts.

  Columns:
  - id (uuid, pk)
  - rival_id (uuid, fk → rival_firms)
  - district_id (uuid) — references districts
  - market_share (numeric 0-1) — fraction of district controlled
  - deal_count (integer) — deals closed here
  - last_active_at (timestamptz)
  - created_at (timestamptz)

  ### `rival_events`
  Log of rival actions that affect the player. These surface as alerts.

  Columns:
  - id (uuid, pk)
  - rival_id (uuid, fk → rival_firms)
  - player_id (uuid, fk → players)
  - event_type (text) — 'territory_encroach' | 'deal_stolen' | 'investor_poached' | 'rep_attack' | 'market_undercutting' | 'territory_takeover' | 'collaboration_offer'
  - district_id (uuid, nullable)
  - title (text)
  - description (text)
  - severity (text) — 'warning' | 'alert' | 'info' | 'opportunity'
  - impact_market_share (numeric) — negative = player loses share
  - impact_reputation (integer) — rep change
  - impact_money (integer) — money impact
  - is_read (boolean)
  - created_at (timestamptz)

  ## Security
  - RLS enabled on all tables
  - rival_firms: public read
  - rival_district_presence: public read
  - rival_events: player can only read/update their own events
*/

-- ── Rival firms ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rival_firms (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text        UNIQUE NOT NULL,
  name             text        NOT NULL,
  tagline          text        NOT NULL DEFAULT '',
  type             text        NOT NULL DEFAULT 'firm' CHECK (type IN ('firm','broker','boutique','international')),
  aggression       integer     NOT NULL DEFAULT 5 CHECK (aggression BETWEEN 1 AND 10),
  reputation_score integer     NOT NULL DEFAULT 50 CHECK (reputation_score BETWEEN 0 AND 100),
  market_focus     text        NOT NULL DEFAULT 'national',
  accent_color     text        NOT NULL DEFAULT '#ef4444',
  founder_name     text        NOT NULL DEFAULT '',
  bio              text        NOT NULL DEFAULT '',
  specialisation   text        NOT NULL DEFAULT '',
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rival_firms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rival firms are public readable"
  ON rival_firms FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── Rival district presence ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rival_district_presence (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rival_id       uuid        NOT NULL REFERENCES rival_firms(id),
  district_id    uuid        NOT NULL,
  market_share   numeric     NOT NULL DEFAULT 0.05 CHECK (market_share >= 0 AND market_share <= 1),
  deal_count     integer     NOT NULL DEFAULT 0,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rival_id, district_id)
);

ALTER TABLE rival_district_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rival presence is public readable"
  ON rival_district_presence FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── Rival events (player notifications) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS rival_events (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rival_id             uuid        NOT NULL REFERENCES rival_firms(id),
  player_id            uuid        NOT NULL REFERENCES players(id),
  event_type           text        NOT NULL CHECK (event_type IN (
                                     'territory_encroach','deal_stolen','investor_poached',
                                     'rep_attack','market_undercutting','territory_takeover',
                                     'collaboration_offer'
                                   )),
  district_id          uuid,
  title                text        NOT NULL,
  description          text        NOT NULL,
  severity             text        NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning','alert','info','opportunity')),
  impact_market_share  numeric     NOT NULL DEFAULT 0,
  impact_reputation    integer     NOT NULL DEFAULT 0,
  impact_money         integer     NOT NULL DEFAULT 0,
  is_read              boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rival_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own rival events"
  ON rival_events FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

CREATE POLICY "Players can insert own rival events"
  ON rival_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can update own rival events"
  ON rival_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

-- ── Seed rival firms ──────────────────────────────────────────────────────────

INSERT INTO rival_firms (slug, name, tagline, type, aggression, reputation_score, market_focus, accent_color, founder_name, bio, specialisation) VALUES

('carvalho_associados',
 'Carvalho & Associados',
 'Portugal''s most connected advisory',
 'firm', 8, 72, 'lisbon', '#ef4444',
 'Diogo Carvalho',
 'Lisbon''s dominant boutique advisory firm. Founded in 2011 by ex-JLL director Diogo Carvalho, they have closed over €400M in hotel transactions. Aggressive, well-networked, and deeply entrenched in the Lisbon market. They view every new entrant as a threat to be neutralised.',
 'Luxury hotel acquisitions, Lisboa district'),

('alves_advisory',
 'Alves Advisory Group',
 'Northern Portugal''s leading hotel specialists',
 'firm', 6, 61, 'north', '#f97316',
 'Beatriz Alves',
 'Porto-based firm run by Beatriz Alves, a former Cushman & Wakefield partner with deep roots in the northern hotel market. Known for patient, methodical deal-making and strong relationships with family-owned properties. Harder to dislodge than to compete with directly.',
 'Boutique hotels, Norte region, family estates'),

('machado_consultancy',
 'Machado Hotel Consultancy',
 'Southern Portugal''s trusted voice',
 'boutique', 5, 55, 'algarve', '#8b5cf6',
 'Jorge Machado',
 'Algarve specialist with unmatched access to coastal resort owners. Jorge Machado built this firm over 20 years through personal relationships — he''s charming, well-liked, and nearly impossible to displace in his territory. Unlikely to fight hard outside the south.',
 'Resort hotels, Algarve coast, tourism assets'),

('summit_hospitality',
 'Summit Hospitality Partners',
 'International capital meets local expertise',
 'international', 9, 68, 'premium', '#06b6d4',
 'Kristofer Lindqvist',
 'A Stockholm-headquartered hospitality advisory with a growing Iberian practice. Well-capitalised, backed by institutional LPs, and willing to absorb short-term losses to build market position. Their international mandate gives them an unfair advantage with foreign buyers — watch the premium segment carefully.',
 'Institutional capital, premium assets, cross-border deals'),

('lisbon_property_desk',
 'Lisbon Property Desk',
 'Fast. Cheap. Everywhere.',
 'broker', 4, 38, 'lisbon', '#64748b',
 'Marco Esteves',
 'A low-cost, high-volume brokerage that undercuts fees to build deal volume. Not a strategic threat — but they clog deal pipelines and confuse sellers about market pricing. Their aggressive marketing keeps them visible to owners who don''t know better.',
 'Volume brokerage, mid-market assets, discount advisory'),

('iberian_capital_advisors',
 'Iberian Capital Advisors',
 'Where institutional money meets opportunity',
 'firm', 7, 64, 'national', '#10b981',
 'Catalina Vega',
 'A Madrid-based advisory with a Lisbon satellite office. Catalina Vega''s team targets the same institutional investors as Swallow Empire — foreign family offices, PE funds, and sovereign wealth mandates. They''re disciplined, data-driven, and a serious long-term rival for the premium investor segment.',
 'Institutional mandates, cross-border capital, PE advisory')

ON CONFLICT (slug) DO NOTHING;
