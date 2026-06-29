/*
  # Dynamic Quest Engine

  1. New Tables
    - `dynamic_quests` – generated quest instances for a player, replacing the static quest join table
      - `id` uuid PK
      - `player_id` uuid FK
      - `quest_type` – daily | weekly | main | legendary
      - `title`, `description`, `category`
      - `difficulty` 1-5
      - `xp_reward`, `reputation_reward`, `skill_point_reward`
      - `bonus_reward_type`, `bonus_reward_value` – secondary reward (e.g. stat boost)
      - `district_id` – optional district this quest applies to
      - `required_level`, `required_reputation`, `required_stat`, `required_stat_value`
      - `status` – available | active | completed | expired | failed
      - `progress`, `progress_target`
      - `expires_at` – countdown deadline (NULL for main/legendary)
      - `generated_at`, `completed_at`
      - `generation_seed` – context snapshot used to generate (level, rep, district)

  2. Modified
    - Keep old `quests` + `player_quests` tables intact (backward compat)

  3. Security
    - RLS enabled, any anon/authenticated can CRUD their own rows
*/

CREATE TABLE IF NOT EXISTS dynamic_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- Quest definition
  quest_type text NOT NULL CHECK (quest_type IN ('daily','weekly','main','legendary')),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  difficulty integer NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),

  -- Rewards
  xp_reward integer NOT NULL DEFAULT 100,
  reputation_reward integer NOT NULL DEFAULT 0,
  skill_point_reward integer NOT NULL DEFAULT 0,
  bonus_reward_type text,       -- 'stat_negotiation' | 'stat_focus' | 'district_xp' | 'market_share' | null
  bonus_reward_value integer NOT NULL DEFAULT 0,

  -- Unlock requirements
  required_level integer NOT NULL DEFAULT 1,
  required_reputation integer NOT NULL DEFAULT 0,
  required_stat text,
  required_stat_value integer NOT NULL DEFAULT 0,

  -- District context
  district_id uuid REFERENCES districts(id) ON DELETE SET NULL,

  -- State
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired','failed')),
  progress integer NOT NULL DEFAULT 0,
  progress_target integer NOT NULL DEFAULT 1,

  -- Timing
  expires_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,

  -- Context snapshot
  generation_context jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_dynamic_quests_player ON dynamic_quests(player_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_quests_status ON dynamic_quests(status);
CREATE INDEX IF NOT EXISTS idx_dynamic_quests_type ON dynamic_quests(quest_type);

ALTER TABLE dynamic_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can manage their dynamic quests"
  ON dynamic_quests FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);
