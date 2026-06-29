/*
  # District Market System

  Creates a living market system where each district has independently evolving
  economic indicators and can generate dynamic events.

  1. New Tables

    - `district_market_data`
      One row per district. Stores all six market indicators (0–100 scale),
      a computed temperature score, and evolution timestamps.
      Indicators: market_temp, opportunities, competition, investor_activity,
                  tourism_growth, luxury_demand

    - `district_events`
      Time-series log of market events per district.
      Each event has a type, severity, description, and expiry.

  2. Seeded with realistic starting values per district region/character

  3. Security: permissive read, open write (no auth required for game prototype)
*/

-- ── Market data ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS district_market_data (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id         uuid NOT NULL REFERENCES districts(id) ON DELETE CASCADE UNIQUE,
  market_temp         integer NOT NULL DEFAULT 50 CHECK (market_temp BETWEEN 0 AND 100),
  opportunities       integer NOT NULL DEFAULT 50 CHECK (opportunities BETWEEN 0 AND 100),
  competition         integer NOT NULL DEFAULT 50 CHECK (competition BETWEEN 0 AND 100),
  investor_activity   integer NOT NULL DEFAULT 50 CHECK (investor_activity BETWEEN 0 AND 100),
  tourism_growth      integer NOT NULL DEFAULT 50 CHECK (tourism_growth BETWEEN 0 AND 100),
  luxury_demand       integer NOT NULL DEFAULT 50 CHECK (luxury_demand BETWEEN 0 AND 100),
  trend_direction     text NOT NULL DEFAULT 'stable' CHECK (trend_direction IN ('rising','falling','stable','volatile')),
  last_evolved_at     timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE district_market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read district market data"
  ON district_market_data FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert district market data"
  ON district_market_data FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can update district market data"
  ON district_market_data FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ── District events ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS district_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id  uuid NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  severity     text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','opportunity','warning','alert')),
  title        text NOT NULL,
  description  text NOT NULL,
  impact       jsonb DEFAULT '{}',
  expires_at   timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE district_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read district events"
  ON district_events FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert district events"
  ON district_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ── Seed market data for all districts ────────────────────────────────────────

INSERT INTO district_market_data (district_id, market_temp, opportunities, competition, investor_activity, tourism_growth, luxury_demand, trend_direction)
SELECT
  d.id,
  CASE d.region
    WHEN 'Lisbon Region' THEN 82
    WHEN 'Algarve'       THEN 78
    WHEN 'North'         THEN 61
    WHEN 'Central'       THEN 44
    WHEN 'Alentejo'      THEN 38
    WHEN 'Islands'       THEN 55
    ELSE 50
  END,
  CASE d.region
    WHEN 'Lisbon Region' THEN 75
    WHEN 'Algarve'       THEN 85
    WHEN 'North'         THEN 58
    WHEN 'Central'       THEN 62
    WHEN 'Alentejo'      THEN 70
    WHEN 'Islands'       THEN 48
    ELSE 50
  END,
  CASE d.region
    WHEN 'Lisbon Region' THEN 88
    WHEN 'Algarve'       THEN 72
    WHEN 'North'         THEN 45
    WHEN 'Central'       THEN 30
    WHEN 'Alentejo'      THEN 20
    WHEN 'Islands'       THEN 35
    ELSE 50
  END,
  CASE d.region
    WHEN 'Lisbon Region' THEN 90
    WHEN 'Algarve'       THEN 80
    WHEN 'North'         THEN 52
    WHEN 'Central'       THEN 40
    WHEN 'Alentejo'      THEN 35
    WHEN 'Islands'       THEN 65
    ELSE 50
  END,
  CASE d.region
    WHEN 'Lisbon Region' THEN 70
    WHEN 'Algarve'       THEN 95
    WHEN 'North'         THEN 55
    WHEN 'Central'       THEN 42
    WHEN 'Alentejo'      THEN 60
    WHEN 'Islands'       THEN 88
    ELSE 50
  END,
  CASE d.region
    WHEN 'Lisbon Region' THEN 85
    WHEN 'Algarve'       THEN 90
    WHEN 'North'         THEN 48
    WHEN 'Central'       THEN 35
    WHEN 'Alentejo'      THEN 55
    WHEN 'Islands'       THEN 72
    ELSE 50
  END,
  CASE d.region
    WHEN 'Lisbon Region' THEN 'rising'
    WHEN 'Algarve'       THEN 'rising'
    WHEN 'North'         THEN 'stable'
    WHEN 'Central'       THEN 'stable'
    WHEN 'Alentejo'      THEN 'rising'
    WHEN 'Islands'       THEN 'volatile'
    ELSE 'stable'
  END
FROM districts d
ON CONFLICT (district_id) DO NOTHING;

-- ── Seed some initial events ──────────────────────────────────────────────────

INSERT INTO district_events (district_id, event_type, severity, title, description, impact, expires_at)
SELECT
  d.id,
  'market_surge',
  'opportunity',
  'Tourist Season Surge',
  'International arrivals up 34% year-on-year. Hotel RevPAR at all-time highs.',
  '{"tourism_growth": 15, "luxury_demand": 10}'::jsonb,
  now() + interval '7 days'
FROM districts d
WHERE d.region = 'Algarve'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO district_events (district_id, event_type, severity, title, description, impact, expires_at)
SELECT
  d.id,
  'foreign_investment',
  'opportunity',
  'Foreign Capital Inflow',
  'A major Middle Eastern SWF is actively scouting luxury assets in this corridor.',
  '{"investor_activity": 20, "luxury_demand": 12}'::jsonb,
  now() + interval '5 days'
FROM districts d
WHERE d.region = 'Lisbon Region'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO district_events (district_id, event_type, severity, title, description, impact, expires_at)
SELECT
  d.id,
  'regulatory_change',
  'warning',
  'AL License Restrictions',
  'New municipal regulations may limit short-term rental conversions in this zone.',
  '{"opportunities": -10, "competition": -8}'::jsonb,
  now() + interval '14 days'
FROM districts d
WHERE d.region = 'Lisbon Region'
LIMIT 1
ON CONFLICT DO NOTHING;
