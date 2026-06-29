/*
  # V1.0 Unified Quest System

  ## Overview
  Introduces three new tables alongside existing ones:
  - `profiles`        — per-player XP progression (level, title, progress)
  - `unified_quests`  — single source of truth for ALL task types
  - `xp_events`       — immutable XP audit log (one row per award)
  - `xp_daily_stats`  — pre-aggregated daily XP totals for analytics graph
  - `level_thresholds` — static lookup table for the 10-level system

  Existing tables (dynamic_quests, official_quests, ai_suggestions) are preserved
  untouched for backward compatibility. New code writes to unified_quests going forward.

  ## Unified Quest Sources
  source IN ('notion', 'ai_mission', 'system', 'manual')

  ## XP Calculation (DB trigger on unified_quests INSERT)
  Priority base:  low=25  medium=50  high=100  critical=200
  Difficulty mul: easy=1.0  medium=1.25  hard=1.5  legendary=2.0
  Quest type mul: daily=1.0  admin=1.0  weekly=1.2  marketing=1.2
                  main=1.5  strategic=1.5  legendary=2.0  sales=2.5

  ## Level System
  10 levels, XP thresholds stored in level_thresholds table.
  award_xp() DB function atomically: records event + updates daily stats + updates profile.
  complete_quest() DB function: idempotent — no double XP.
*/

-- ─── level_thresholds ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS level_thresholds (
  level        integer PRIMARY KEY CHECK (level BETWEEN 1 AND 10),
  xp_required  integer NOT NULL,
  title        text NOT NULL
);

INSERT INTO level_thresholds (level, xp_required, title) VALUES
  (1,       0, 'Apprentice Operator'),
  (2,    1000, 'Deal Scout'),
  (3,    2500, 'Pipeline Builder'),
  (4,    7500, 'Empire Operator'),
  (5,   15000, 'Strategic Closer'),
  (6,   30000, 'Market Commander'),
  (7,   50000, 'Empire Architect'),
  (8,   65000, 'Capital Strategist'),
  (9,   80000, 'Sovereign Operator'),
  (10, 100000, 'Empire Master')
ON CONFLICT (level) DO UPDATE SET
  xp_required = EXCLUDED.xp_required,
  title        = EXCLUDED.title;

ALTER TABLE level_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read level thresholds"
  ON level_thresholds FOR SELECT TO authenticated, anon USING (true);

-- ─── profiles ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id          uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  display_name       text NOT NULL DEFAULT '',
  total_xp           integer NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  current_level      integer NOT NULL DEFAULT 1 CHECK (current_level BETWEEN 1 AND 10),
  current_title      text NOT NULL DEFAULT 'Apprentice Operator',
  xp_to_next_level   integer NOT NULL DEFAULT 1000,
  level_progress_pct integer NOT NULL DEFAULT 0 CHECK (level_progress_pct BETWEEN 0 AND 100),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_player ON profiles(player_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read profiles"
  ON profiles FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Users can insert profiles"
  ON profiles FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "Users can update profiles"
  ON profiles FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- ─── unified_quests ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unified_quests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  notion_id    text,  -- nullable; unique index only on non-null values

  -- Provenance
  source       text NOT NULL DEFAULT 'system'
               CHECK (source IN ('notion','ai_mission','system','manual')),

  -- Content
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  category     text NOT NULL DEFAULT 'general',
  quest_type   text NOT NULL DEFAULT 'daily'
               CHECK (quest_type IN ('daily','weekly','main','legendary',
                                     'admin','marketing','sales','strategic')),
  priority     text NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low','medium','high','critical')),
  difficulty   text NOT NULL DEFAULT 'medium'
               CHECK (difficulty IN ('easy','medium','hard','legendary')),
  reward_text  text,

  -- State
  status       text NOT NULL DEFAULT 'not_started'
               CHECK (status IN ('not_started','in_progress','done','blocked','expired')),
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,

  -- XP (auto-calculated by trigger if 0 on insert)
  xp_reward    integer NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),

  -- Flexible extra fields (tags, rationale, generation_context, impact, etc.)
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: notion_id must be unique but only when not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_quests_notion_id
  ON unified_quests(player_id, notion_id)
  WHERE notion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unified_quests_player   ON unified_quests(player_id);
CREATE INDEX IF NOT EXISTS idx_unified_quests_status   ON unified_quests(status);
CREATE INDEX IF NOT EXISTS idx_unified_quests_source   ON unified_quests(source);
CREATE INDEX IF NOT EXISTS idx_unified_quests_complete ON unified_quests(player_id, completed);
CREATE INDEX IF NOT EXISTS idx_unified_quests_created  ON unified_quests(player_id, created_at DESC);

ALTER TABLE unified_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own unified quests"
  ON unified_quests FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Users can insert own unified quests"
  ON unified_quests FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "Users can update own unified quests"
  ON unified_quests FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- ─── XP auto-calculation trigger ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_quest_xp(
  p_priority   text,
  p_difficulty text,
  p_quest_type text
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  base_xp  integer;
  diff_mul numeric;
  type_mul numeric;
BEGIN
  base_xp := CASE p_priority
    WHEN 'low'      THEN 25
    WHEN 'medium'   THEN 50
    WHEN 'high'     THEN 100
    WHEN 'critical' THEN 200
    ELSE 50
  END;
  diff_mul := CASE p_difficulty
    WHEN 'easy'      THEN 1.0
    WHEN 'medium'    THEN 1.25
    WHEN 'hard'      THEN 1.5
    WHEN 'legendary' THEN 2.0
    ELSE 1.25
  END;
  type_mul := CASE p_quest_type
    WHEN 'daily'      THEN 1.0
    WHEN 'admin'      THEN 1.0
    WHEN 'weekly'     THEN 1.2
    WHEN 'marketing'  THEN 1.2
    WHEN 'main'       THEN 1.5
    WHEN 'strategic'  THEN 1.5
    WHEN 'legendary'  THEN 2.0
    WHEN 'sales'      THEN 2.5
    ELSE 1.0
  END;
  RETURN GREATEST(10, ROUND(base_xp * diff_mul * type_mul));
END;
$$;

CREATE OR REPLACE FUNCTION unified_quests_auto_xp() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.xp_reward = 0 THEN
    NEW.xp_reward := calculate_quest_xp(NEW.priority, NEW.difficulty, NEW.quest_type);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unified_quests_auto_xp ON unified_quests;
CREATE TRIGGER trg_unified_quests_auto_xp
  BEFORE INSERT OR UPDATE ON unified_quests
  FOR EACH ROW EXECUTE FUNCTION unified_quests_auto_xp();

-- ─── xp_events ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS xp_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  quest_id   uuid REFERENCES unified_quests(id) ON DELETE SET NULL,
  xp_amount  integer NOT NULL CHECK (xp_amount > 0),
  source     text NOT NULL DEFAULT 'quest_complete'
             CHECK (source IN ('quest_complete','level_up_bonus','achievement','manual')),
  reason     text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_events_player  ON xp_events(player_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_date    ON xp_events(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_quest   ON xp_events(quest_id) WHERE quest_id IS NOT NULL;

ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own xp events"
  ON xp_events FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Users can insert own xp events"
  ON xp_events FOR INSERT TO authenticated, anon WITH CHECK (true);

-- ─── xp_daily_stats ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS xp_daily_stats (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  stat_date        date NOT NULL,
  xp_earned        integer NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  quests_completed integer NOT NULL DEFAULT 0 CHECK (quests_completed >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_xp_daily_player_date ON xp_daily_stats(player_id, stat_date DESC);

ALTER TABLE xp_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily stats"
  ON xp_daily_stats FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Users can upsert own daily stats"
  ON xp_daily_stats FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "Users can update own daily stats"
  ON xp_daily_stats FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- ─── award_xp() — atomic XP award ────────────────────────────────────────────
-- Records xp_event + upserts daily stats + upserts/updates profile.
-- Returns updated profile fields + whether a level-up occurred.

CREATE OR REPLACE FUNCTION award_xp(
  p_player_id uuid,
  p_xp        integer,
  p_source    text,
  p_reason    text,
  p_quest_id  uuid DEFAULT NULL
) RETURNS TABLE (
  total_xp           integer,
  current_level      integer,
  current_title      text,
  xp_to_next_level   integer,
  level_progress_pct integer,
  leveled_up         boolean
) LANGUAGE plpgsql AS $$
DECLARE
  v_old_level  integer;
  v_new_level  integer;
  v_new_total  integer;
  v_next_xp    integer;
  v_prev_xp    integer;
  v_title      text;
  v_progress   integer;
  v_leveled_up boolean := false;
BEGIN
  -- 1. XP event log
  INSERT INTO xp_events (player_id, quest_id, xp_amount, source, reason)
  VALUES (p_player_id, p_quest_id, p_xp, p_source, p_reason);

  -- 2. Daily stats upsert
  INSERT INTO xp_daily_stats (player_id, stat_date, xp_earned, quests_completed)
  VALUES (p_player_id, CURRENT_DATE, p_xp,
          CASE WHEN p_source = 'quest_complete' THEN 1 ELSE 0 END)
  ON CONFLICT (player_id, stat_date) DO UPDATE SET
    xp_earned        = xp_daily_stats.xp_earned + EXCLUDED.xp_earned,
    quests_completed = xp_daily_stats.quests_completed + EXCLUDED.quests_completed,
    updated_at       = now();

  -- 3. Upsert profile total
  INSERT INTO profiles (player_id, total_xp)
  VALUES (p_player_id, p_xp)
  ON CONFLICT (player_id) DO UPDATE SET
    total_xp   = profiles.total_xp + p_xp,
    updated_at = now();

  -- 4. Read updated total + old level
  SELECT p.total_xp, p.current_level INTO v_new_total, v_old_level
  FROM profiles p WHERE p.player_id = p_player_id;

  -- 5. Compute new level from thresholds
  SELECT lt.level, lt.title INTO v_new_level, v_title
  FROM level_thresholds lt
  WHERE lt.xp_required <= v_new_total
  ORDER BY lt.level DESC LIMIT 1;

  -- Next threshold XP
  SELECT lt.xp_required INTO v_next_xp
  FROM level_thresholds lt WHERE lt.level = v_new_level + 1;

  -- Current threshold XP (for progress %)
  SELECT lt.xp_required INTO v_prev_xp
  FROM level_thresholds lt WHERE lt.level = v_new_level;

  IF v_next_xp IS NULL THEN
    v_progress := 100;
    v_next_xp  := v_new_total; -- max level
  ELSE
    v_progress := LEAST(100, GREATEST(0,
      ROUND(100.0 * (v_new_total - v_prev_xp) / NULLIF(v_next_xp - v_prev_xp, 0))::integer
    ));
  END IF;

  IF v_new_level > v_old_level THEN v_leveled_up := true; END IF;

  -- 6. Write computed level back
  UPDATE profiles SET
    current_level      = v_new_level,
    current_title      = v_title,
    xp_to_next_level   = GREATEST(0, v_next_xp - v_new_total),
    level_progress_pct = v_progress,
    updated_at         = now()
  WHERE player_id = p_player_id;

  RETURN QUERY SELECT v_new_total, v_new_level, v_title,
    GREATEST(0, v_next_xp - v_new_total), v_progress, v_leveled_up;
END;
$$;

-- ─── complete_quest() — idempotent quest completion ───────────────────────────
-- Marks quest done + awards XP exactly once.
-- Safe to call multiple times; only first call awards XP.

CREATE OR REPLACE FUNCTION complete_quest(
  p_player_id uuid,
  p_quest_id  uuid
) RETURNS TABLE (
  xp_awarded         integer,
  already_completed  boolean,
  total_xp           integer,
  current_level      integer,
  current_title      text,
  xp_to_next_level   integer,
  level_progress_pct integer,
  leveled_up         boolean
) LANGUAGE plpgsql AS $$
DECLARE
  v_quest        unified_quests%ROWTYPE;
  v_already_done boolean;
BEGIN
  SELECT * INTO v_quest
  FROM unified_quests
  WHERE id = p_quest_id AND player_id = p_player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quest % not found for player %', p_quest_id, p_player_id;
  END IF;

  v_already_done := v_quest.completed;

  -- Mark complete (idempotent)
  UPDATE unified_quests SET
    completed    = true,
    completed_at = COALESCE(completed_at, now()),
    status       = 'done',
    updated_at   = now()
  WHERE id = p_quest_id;

  IF v_already_done THEN
    RETURN QUERY
      SELECT 0, true, p.total_xp, p.current_level, p.current_title,
             p.xp_to_next_level, p.level_progress_pct, false
      FROM profiles p WHERE p.player_id = p_player_id;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT v_quest.xp_reward, false,
           r.total_xp, r.current_level, r.current_title,
           r.xp_to_next_level, r.level_progress_pct, r.leveled_up
    FROM award_xp(p_player_id, v_quest.xp_reward, 'quest_complete',
                  'Completed: ' || v_quest.title, p_quest_id) r;
END;
$$;
