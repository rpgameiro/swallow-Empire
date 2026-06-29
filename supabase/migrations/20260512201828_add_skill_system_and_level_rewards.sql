/*
  # Add Skill System and Level Rewards

  1. Changes to `players` table
    - Add 6 RPG stats: negotiation, networking, leadership (alongside existing focus, discipline, reputation)
    - Add `skill_points` (integer) – unspent points the player can allocate
    - Add `total_skill_points_earned` (integer) – lifetime tracking

  2. New table: `level_rewards`
    - Defines what each level-up grants (stat boosts, skill points, unlocks, flavour text)
    - Stored in DB so future content updates don't require code deploys

  3. New table: `player_level_history`
    - Audit log of every level-up with timestamp and what was rewarded

  4. Important Notes
    - focus and discipline already exist on players – no migration needed for those
    - reputation is already on players – rename conceptually to global reputation; district_reputation is per-district
    - skill_points start at 0; each level grants 1–3 depending on level milestone
    - auto stat gains happen on level-up per level_rewards row
*/

-- Add skill columns to players
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='negotiation') THEN
    ALTER TABLE players ADD COLUMN negotiation integer NOT NULL DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='networking') THEN
    ALTER TABLE players ADD COLUMN networking integer NOT NULL DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='leadership') THEN
    ALTER TABLE players ADD COLUMN leadership integer NOT NULL DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='skill_points') THEN
    ALTER TABLE players ADD COLUMN skill_points integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='total_skill_points_earned') THEN
    ALTER TABLE players ADD COLUMN total_skill_points_earned integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Level rewards table
CREATE TABLE IF NOT EXISTS level_rewards (
  level integer PRIMARY KEY,
  title text NOT NULL,
  flavour_text text NOT NULL,
  skill_points_granted integer NOT NULL DEFAULT 1,
  auto_negotiation integer NOT NULL DEFAULT 0,
  auto_networking integer NOT NULL DEFAULT 0,
  auto_focus integer NOT NULL DEFAULT 0,
  auto_discipline integer NOT NULL DEFAULT 0,
  auto_leadership integer NOT NULL DEFAULT 0,
  auto_reputation integer NOT NULL DEFAULT 0,
  unlock_type text,
  unlock_ref text,
  badge_color text NOT NULL DEFAULT '#f59e0b'
);

ALTER TABLE level_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read level_rewards"
  ON level_rewards FOR SELECT
  TO authenticated, anon
  USING (true);

-- Player level history
CREATE TABLE IF NOT EXISTS player_level_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  level_reached integer NOT NULL,
  rewarded_at timestamptz DEFAULT now()
);

ALTER TABLE player_level_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read player_level_history"
  ON player_level_history FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can insert player_level_history"
  ON player_level_history FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Seed level rewards (levels 1–50)
INSERT INTO level_rewards (level, title, flavour_text, skill_points_granted, auto_negotiation, auto_networking, auto_focus, auto_discipline, auto_leadership, auto_reputation, unlock_type, unlock_ref, badge_color) VALUES
(1,  'Advisory Intern',    'Your journey begins in Lisbon. The market awaits.',                          1, 0, 0, 0, 0, 0,  0, null, null, '#64748b'),
(2,  'Junior Strategist',  'First deals close. Your name starts to travel.',                             1, 1, 0, 0, 0, 0,  5, null, null, '#64748b'),
(3,  'Market Scout',       'You read the terrain. Patterns emerge from chaos.',                          1, 0, 1, 1, 0, 0,  5, 'district', 'Leiria', '#3b82f6'),
(4,  'Deal Apprentice',    'Bigger rooms, bigger numbers. Confidence grows.',                            2, 1, 0, 0, 1, 0,  8, 'district', 'Santarém', '#3b82f6'),
(5,  'Network Builder',    'You know the names that matter. They know yours.',                           2, 0, 2, 0, 0, 1, 10, 'district', 'Setúbal', '#06b6d4'),
(6,  'Property Analyst',   'Your reports are circulated. Rivals watch.',                                 2, 1, 0, 1, 1, 0, 10, 'district', 'Madeira', '#06b6d4'),
(7,  'Deal Broker',        'You no longer wait for opportunities — you create them.',                    2, 0, 1, 0, 0, 1, 15, null, null, '#10b981'),
(8,  'Regional Advisor',   'Porto calls. The north wants your counsel.',                                 2, 1, 1, 0, 1, 0, 15, 'quest', 'legendary', '#10b981'),
(9,  'Market Authority',   'Three regions. One voice guiding millions.',                                 2, 0, 0, 2, 0, 1, 20, null, null, '#10b981'),
(10, 'Senior Strategist',  'A decade of insight compressed into a handshake.',                          3, 2, 1, 0, 1, 1, 25, 'district', 'Açores', '#f59e0b'),
(11, 'Investment Lead',    'Your fund attracts institutional eyes.',                                     2, 1, 0, 1, 0, 1, 20, null, null, '#f59e0b'),
(12, 'Portfolio Director', 'You manage assets that span two regions.',                                   2, 0, 2, 0, 1, 1, 25, null, null, '#f59e0b'),
(13, 'Deal Architect',     'Complex structures, elegant solutions.',                                     2, 2, 0, 1, 0, 1, 25, null, null, '#f59e0b'),
(14, 'Capital Connector',  'Your network spans every boardroom in Portugal.',                            2, 0, 2, 0, 1, 1, 30, null, null, '#f59e0b'),
(15, 'Advisory Partner',   'Junior partners defer to your judgment.',                                    3, 1, 1, 1, 1, 1, 35, 'quest', 'legendary', '#f97316'),
(16, 'Market Influencer',  'Press mentions. Speaking invitations arrive.',                               2, 1, 1, 0, 1, 1, 30, null, null, '#f97316'),
(17, 'Territory Commander','Three districts bow to your strategy.',                                      2, 0, 1, 2, 0, 1, 30, null, null, '#f97316'),
(18, 'Asset Specialist',   'Boutique hotel underwriting — you wrote the playbook.',                     2, 2, 0, 1, 0, 2, 35, null, null, '#f97316'),
(19, 'Growth Catalyst',    'You multiply value wherever you enter.',                                     2, 0, 2, 1, 1, 1, 35, null, null, '#f97316'),
(20, 'Principal Advisor',  'Your firm. Your rules. The empire takes shape.',                             3, 2, 2, 1, 1, 2, 50, 'quest', 'legendary', '#ef4444'),
(21, 'Fund Strategist',    'Institutional capital follows your lead.',                                   2, 1, 1, 1, 1, 1, 40, null, null, '#ef4444'),
(22, 'Regional Sovereign', 'Two full regions under your advisory control.',                              2, 1, 1, 0, 2, 1, 40, null, null, '#ef4444'),
(23, 'Boutique Legend',    'Your advisory fees command premium rates.',                                  2, 2, 0, 1, 1, 2, 45, null, null, '#ef4444'),
(24, 'Conquest Planner',   'No market too small, no deal too complex.',                                  2, 0, 2, 2, 0, 1, 45, null, null, '#ef4444'),
(25, 'Empire Architect',   'Half of Portugal. The other half is next.',                                  3, 2, 2, 1, 2, 2, 60, 'quest', 'legendary', '#dc2626'),
(26, 'Master Negotiator',  'Your counter-offers are legendary.',                                         2, 3, 0, 1, 1, 1, 50, null, null, '#dc2626'),
(27, 'Network Sovereign',  'Six degrees? You need two.',                                                 2, 0, 3, 1, 1, 1, 50, null, null, '#dc2626'),
(28, 'Vision Holder',      'You see the market five years ahead.',                                       2, 1, 1, 2, 1, 2, 55, null, null, '#dc2626'),
(29, 'Discipline Icon',    'Your consistency becomes legend.',                                           2, 1, 0, 2, 2, 1, 55, null, null, '#dc2626'),
(30, 'Hotel Titan',        'The boutique hotel world answers to you.',                                   3, 2, 2, 2, 2, 2, 75, 'quest', 'legendary', '#b91c1c'),
(31, 'Market Oracle',      'Your predictions reshape investment theses.',                                2, 2, 1, 1, 1, 2, 60, null, null, '#b91c1c'),
(32, 'Alliance Builder',   'Consortiums form at your invitation.',                                       2, 0, 3, 1, 1, 2, 60, null, null, '#b91c1c'),
(33, 'Power Broker',       'Governments consult your market reports.',                                   2, 2, 1, 1, 2, 2, 65, null, null, '#b91c1c'),
(34, 'Wealth Architect',   'Generational wealth. Yours and your clients.',                               2, 1, 1, 2, 1, 3, 65, null, null, '#b91c1c'),
(35, 'National Authority', 'No district off-limits. Complete access.',                                   3, 2, 2, 2, 2, 3, 80, 'quest', 'legendary', '#7c3aed'),
(36, 'Grand Strategist',   'The chessboard is Portugal. You hold every piece.',                          2, 2, 1, 2, 2, 2, 70, null, null, '#7c3aed'),
(37, 'Capital Overlord',   'Your AUM rivals institutional giants.',                                      2, 1, 2, 2, 1, 3, 70, null, null, '#7c3aed'),
(38, 'Legacy Builder',     'Books are written. Case studies bear your name.',                            2, 2, 2, 1, 2, 2, 75, null, null, '#7c3aed'),
(39, 'Visionary Elite',    'You reimagine what hospitality investment means.',                           2, 1, 2, 2, 2, 3, 75, null, null, '#7c3aed'),
(40, 'Sovereign Advisor',  'A single firm. A whole country. Your country.',                              3, 3, 3, 2, 2, 3, 100, 'quest', 'legendary', '#6d28d9'),
(41, 'Continental Eye',    'European funds seek Portuguese exposure through you.',                       2, 2, 2, 2, 2, 3, 80, null, null, '#6d28d9'),
(42, 'Market Conqueror',   'Every major deal passes through your desk.',                                 2, 2, 2, 2, 2, 3, 80, null, null, '#6d28d9'),
(43, 'Investment God',     'They don''t call it luck anymore. They call it Ricardo.',                   2, 2, 2, 2, 3, 3, 85, null, null, '#6d28d9'),
(44, 'Myth Builder',       'The market whispers your name before announcements.',                        2, 2, 3, 2, 2, 3, 85, null, null, '#6d28d9'),
(45, 'Dynasty Founder',    'You are the institution now.',                                               3, 3, 3, 3, 3, 3, 120, 'quest', 'legendary', '#4c1d95'),
(46, 'Empire Custodian',   'Future strategists study your framework.',                                   2, 2, 2, 3, 2, 3, 90, null, null, '#4c1d95'),
(47, 'Market God',         'Price discovery ends and begins with your analysis.',                        2, 3, 2, 2, 3, 3, 90, null, null, '#4c1d95'),
(48, 'Untouchable',        'No competitor dares enter your territories.',                                2, 2, 3, 2, 3, 3, 95, null, null, '#4c1d95'),
(49, 'The Standard',       'Advisory excellence redefined. The bar is you.',                             2, 2, 2, 3, 3, 3, 95, null, null, '#4c1d95'),
(50, 'Swallow Emperor',    'Portugal''s boutique hotel advisory empire — complete.',                     3, 5, 5, 5, 5, 5, 200, 'quest', 'legendary', '#f59e0b')
ON CONFLICT (level) DO NOTHING;
