/*
  # Swallow Empire Game Schema

  1. New Tables
    - `players` - Main player profile
    - `player_stats` - Current player statistics
    - `quests` - Available quests in the game
    - `player_quests` - Player's quest progress
    - `achievements` - Available achievements
    - `player_achievements` - Player's earned achievements
    - `districts` - Portugal districts
    - `player_districts` - Player's district ownership/control

  2. Security
    - Enable RLS on all tables
    - Add policies for players to access their own data

  3. Important Notes
    - Single player game, using anonymous user for now
    - Data persists via localStorage primarily, Supabase as backup
    - No authentication required for MVP
*/

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Ricardo Gameiro',
  level integer NOT NULL DEFAULT 1,
  total_xp bigint NOT NULL DEFAULT 0,
  current_xp integer NOT NULL DEFAULT 0,
  xp_to_next_level integer NOT NULL DEFAULT 1000,
  focus integer NOT NULL DEFAULT 100,
  discipline integer NOT NULL DEFAULT 100,
  reputation integer NOT NULL DEFAULT 0,
  no_trading_streak integer NOT NULL DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  deals_closed integer NOT NULL DEFAULT 0,
  properties_acquired integer NOT NULL DEFAULT 0,
  total_investment bigint NOT NULL DEFAULT 0,
  contracts_violated integer NOT NULL DEFAULT 0,
  trades_executed integer NOT NULL DEFAULT 0,
  quest_completed integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  region text NOT NULL,
  base_difficulty integer NOT NULL,
  hotel_opportunity_count integer NOT NULL DEFAULT 3,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  district_id uuid NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  control_level integer NOT NULL DEFAULT 0,
  hotels_invested integer NOT NULL DEFAULT 0,
  market_share real NOT NULL DEFAULT 0.0,
  last_action_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, district_id)
);

CREATE TABLE IF NOT EXISTS quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  quest_type text NOT NULL,
  category text NOT NULL,
  xp_reward integer NOT NULL,
  difficulty integer NOT NULL,
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  quest_id uuid NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  progress integer NOT NULL DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  xp_earned integer NOT NULL DEFAULT 0,
  UNIQUE(player_id, quest_id)
);

CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  icon text NOT NULL,
  xp_reward integer NOT NULL,
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE(player_id, achievement_id)
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read players"
  ON players FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can read player_stats"
  ON player_stats FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can read districts"
  ON districts FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can read player_districts"
  ON player_districts FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can read quests"
  ON quests FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can read player_quests"
  ON player_quests FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can read achievements"
  ON achievements FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can read player_achievements"
  ON player_achievements FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can insert/update players"
  ON players FOR ALL
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Anyone can insert/update player_stats"
  ON player_stats FOR ALL
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Anyone can insert/update player_districts"
  ON player_districts FOR ALL
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Anyone can insert/update player_quests"
  ON player_quests FOR ALL
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Anyone can insert/update player_achievements"
  ON player_achievements FOR ALL
  TO authenticated, anon
  WITH CHECK (true);

INSERT INTO districts (name, description, region, base_difficulty, hotel_opportunity_count) VALUES
('Lisboa', 'Capital hub with premium hotel opportunities', 'Lisbon Region', 3, 5),
('Porto', 'Northern powerhouse with historic charm', 'North', 2, 4),
('Leiria', 'Central region with growth potential', 'Central', 2, 3),
('Santarém', 'Strategic central location', 'Central', 2, 2),
('Setúbal', 'Coastal gem with emerging market', 'Lisbon Region', 2, 3),
('Évora', 'Historic cultural destination', 'Alentejo', 1, 2),
('Beja', 'Interior region with untapped potential', 'Alentejo', 1, 2),
('Faro', 'Algarve tourism hub', 'Algarve', 3, 4),
('Braga', 'Religious and cultural center', 'North', 2, 3),
('Coimbra', 'University city with character', 'Central', 2, 3),
('Madeira', 'Island luxury destination', 'Islands', 4, 2),
('Açores', 'Remote island archipelago', 'Islands', 4, 2);
