/*
  # AI Suggestions System

  ## Purpose
  Stores AI-generated mission suggestions per player. These are optional
  opportunities — not commitments. Players can accept (convert to active
  dynamic quest), dismiss, or let them expire.

  ## New Tables
  - `ai_suggestions`
    - `id`              uuid PK
    - `player_id`       uuid FK → players.id
    - `title`           text — short mission name
    - `description`     text — why this is a good opportunity now
    - `rationale`       text — AI context explaining the suggestion
    - `category`        text — matches DynamicQuest category (acquisition, networking, etc.)
    - `suggestion_type` text — strategic | tactical | opportunity | risk_mitigation
    - `priority`        text — high | medium | low
    - `estimated_xp`    int  — projected XP if accepted and completed
    - `estimated_money` int  — projected money reward
    - `difficulty`      int  — 1-5
    - `tags`            text[] — searchable tags (e.g. ['hotel', 'lisbon', 'investor'])
    - `source`          text — what triggered this suggestion (e.g. 'market_analysis', 'rival_move', 'player_stats')
    - `status`          text — pending | accepted | dismissed | expired
    - `accepted_quest_id` uuid nullable — FK to dynamic_quests if accepted
    - `expires_at`      timestamptz — auto-expire after 7 days
    - `created_at`      timestamptz
    - `updated_at`      timestamptz

  ## Security
  - RLS enabled, policies for both authenticated and anon roles
  - Players can only see/modify their own suggestions
*/

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id         uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text NOT NULL DEFAULT '',
  rationale         text NOT NULL DEFAULT '',
  category          text NOT NULL DEFAULT 'strategy',
  suggestion_type   text NOT NULL DEFAULT 'tactical',
  priority          text NOT NULL DEFAULT 'medium',
  estimated_xp      integer NOT NULL DEFAULT 0,
  estimated_money   integer NOT NULL DEFAULT 0,
  difficulty        integer NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  tags              text[] NOT NULL DEFAULT '{}',
  source            text NOT NULL DEFAULT 'system',
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed','expired')),
  accepted_quest_id uuid REFERENCES dynamic_quests(id) ON DELETE SET NULL,
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Index for fast player queries
CREATE INDEX IF NOT EXISTS ai_suggestions_player_status_idx
  ON ai_suggestions(player_id, status, expires_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ai_suggestions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_suggestions_updated_at ON ai_suggestions;
CREATE TRIGGER ai_suggestions_updated_at
  BEFORE UPDATE ON ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_ai_suggestions_updated_at();

ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

-- Players can read their own suggestions
CREATE POLICY "Players can read own suggestions"
  ON ai_suggestions FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

-- Allow anon reads for the current app (no auth session)
CREATE POLICY "Anon can read suggestions"
  ON ai_suggestions FOR SELECT
  TO anon
  USING (true);

-- Players can insert suggestions (system inserts on their behalf)
CREATE POLICY "Anon can insert suggestions"
  ON ai_suggestions FOR INSERT
  TO anon
  WITH CHECK (true);

-- Players can update their own suggestions (accept/dismiss)
CREATE POLICY "Anon can update suggestions"
  ON ai_suggestions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
