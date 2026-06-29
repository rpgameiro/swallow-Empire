/*
  # NPC System

  ## Summary
  Creates the full NPC (Non-Player Character) system for Swallow Empire.
  NPCs are named individuals the player encounters across Portugal's districts.
  Each NPC remembers past interactions, maintains a trust level, and responds
  based on their personality and relationship status with the player.

  ## New Tables

  ### `npcs`
  Defines each NPC archetype: name, type, personality, district, negotiation style.
  This is the template table — one row per NPC character.

  Columns:
  - `id` (uuid, pk)
  - `slug` (text, unique) — machine-readable identifier e.g. 'ana_costa_lisbon'
  - `type` (text) — 'investor' | 'owner' | 'broker' | 'developer' | 'operator' | 'competitor'
  - `name` (text) — Full display name
  - `title` (text) — Short professional title e.g. "Senior Partner, Lusitano Capital"
  - `district_name` (text) — Human-readable district name for display
  - `personality` (text) — 'analytical' | 'aggressive' | 'charming' | 'cautious' | 'visionary' | 'pragmatic'
  - `negotiation_style` (text) — 'hardball' | 'collaborative' | 'emotional' | 'data_driven' | 'intuitive'
  - `avatar_initials` (text) — 2-char initials for avatar
  - `accent_color` (text) — hex color for this NPC's theme
  - `base_trust` (integer) — Starting trust 0–100
  - `min_player_level` (integer) — Minimum player level to encounter this NPC
  - `rep_track` (text) — Which rep track they belong to
  - `backstory` (text) — 1-2 sentence background flavor text
  - `created_at` (timestamptz)

  ### `player_npc_relationships`
  Tracks per-player state for each NPC: trust level, relationship status,
  interaction count, last seen timestamp.

  Columns:
  - `id` (uuid, pk)
  - `player_id` (uuid, fk → players)
  - `npc_id` (uuid, fk → npcs)
  - `trust_level` (integer) — 0–100 current trust
  - `relationship_status` (text) — 'stranger' | 'acquaintance' | 'contact' | 'ally' | 'partner' | 'rival'
  - `interaction_count` (integer) — total interactions
  - `last_interaction_at` (timestamptz)
  - `notes` (text[]) — array of remembered interaction notes
  - `unlocked_at` (timestamptz)

  ### `npc_interaction_log`
  Immutable log of every player–NPC dialogue choice made.

  Columns:
  - `id` (uuid, pk)
  - `player_id` (uuid, fk → players)
  - `npc_id` (uuid, fk → npcs)
  - `dialogue_id` (text) — which dialogue template was shown
  - `choice_id` (text) — which option the player picked
  - `outcome_text` (text) — result flavor text
  - `trust_delta` (integer) — trust change from this interaction
  - `rep_delta` (integer) — rep track change
  - `money_delta` (integer) — money gained/lost
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all three tables
  - Players can only read/write their own relationship and log rows
  - NPC definitions are public-read (no auth required for npcs table)
*/

-- ── NPC definitions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS npcs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text        UNIQUE NOT NULL,
  type              text        NOT NULL CHECK (type IN ('investor','owner','broker','developer','operator','competitor')),
  name              text        NOT NULL,
  title             text        NOT NULL DEFAULT '',
  district_name     text        NOT NULL DEFAULT '',
  personality       text        NOT NULL CHECK (personality IN ('analytical','aggressive','charming','cautious','visionary','pragmatic')),
  negotiation_style text        NOT NULL CHECK (negotiation_style IN ('hardball','collaborative','emotional','data_driven','intuitive')),
  avatar_initials   text        NOT NULL DEFAULT '',
  accent_color      text        NOT NULL DEFAULT '#f59e0b',
  base_trust        integer     NOT NULL DEFAULT 30,
  min_player_level  integer     NOT NULL DEFAULT 1,
  rep_track         text        NOT NULL CHECK (rep_track IN ('investor','owner','market','operator')),
  backstory         text        NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE npcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "NPCs are public readable"
  ON npcs FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── Player–NPC relationships ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_npc_relationships (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           uuid        NOT NULL REFERENCES players(id),
  npc_id              uuid        NOT NULL REFERENCES npcs(id),
  trust_level         integer     NOT NULL DEFAULT 30,
  relationship_status text        NOT NULL DEFAULT 'stranger'
                                  CHECK (relationship_status IN ('stranger','acquaintance','contact','ally','partner','rival')),
  interaction_count   integer     NOT NULL DEFAULT 0,
  last_interaction_at timestamptz,
  notes               text[]      NOT NULL DEFAULT '{}',
  unlocked_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, npc_id)
);

ALTER TABLE player_npc_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own NPC relationships"
  ON player_npc_relationships FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

CREATE POLICY "Players can insert own NPC relationships"
  ON player_npc_relationships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can update own NPC relationships"
  ON player_npc_relationships FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

-- ── NPC interaction log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS npc_interaction_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     uuid        NOT NULL REFERENCES players(id),
  npc_id        uuid        NOT NULL REFERENCES npcs(id),
  dialogue_id   text        NOT NULL,
  choice_id     text        NOT NULL,
  outcome_text  text        NOT NULL DEFAULT '',
  trust_delta   integer     NOT NULL DEFAULT 0,
  rep_delta     integer     NOT NULL DEFAULT 0,
  money_delta   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE npc_interaction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own interaction log"
  ON npc_interaction_log FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

CREATE POLICY "Players can insert own interaction log"
  ON npc_interaction_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

-- ── Seed NPC data ─────────────────────────────────────────────────────────────

INSERT INTO npcs (slug, type, name, title, district_name, personality, negotiation_style, avatar_initials, accent_color, base_trust, min_player_level, rep_track, backstory) VALUES

-- INVESTORS
('ana_costa',       'investor', 'Ana Costa',        'Managing Partner, Lusitano Capital',    'Lisboa',   'analytical',  'data_driven',   'AC', '#3b82f6', 25, 1,  'investor', 'Former Goldman analyst who returned to Portugal to build the country''s premier hospitality fund. She respects data and has no patience for vague projections.'),
('miguel_faria',    'investor', 'Miguel Faria',     'Principal, Atlantic Ventures',          'Porto',    'cautious',    'collaborative', 'MF', '#06b6d4', 30, 3,  'investor', 'Third-generation Porto banker who prefers slow-burn relationships. Once trusted, he becomes an invaluable long-term capital partner.'),
('sofia_nunes',     'investor', 'Sofia Nunes',      'Family Office Director, Nunes Group',   'Cascais',  'charming',    'intuitive',     'SN', '#ec4899', 20, 6,  'investor', 'Manages €120M of the Nunes family''s hospitality allocation. She invests in people first, assets second — chemistry matters as much as returns.'),
('rafael_branco',   'investor', 'Rafael Branco',    'PE Director, Meridian Fund IV',         'Lisboa',   'aggressive',  'hardball',      'RB', '#ef4444', 15, 10, 'investor', 'London-educated PE director with a reputation for squeezing advisors on fees. But win his respect and the deal flow never stops.'),

-- HOTEL OWNERS
('carlos_mendes',   'owner',    'Carlos Mendes',    'Proprietor, Mendes Hotels',             'Algarve',  'pragmatic',   'collaborative', 'CM', '#10b981', 35, 1,  'owner', 'Owns four boutique hotels along the Algarve coast, inherited from his father. Loyal to advisors who deliver — disloyal to those who don''t.'),
('helena_rodrigues','owner',    'Helena Rodrigues', 'Owner, Quinta Rodrigues Estate',        'Alentejo', 'cautious',    'emotional',     'HR', '#f59e0b', 40, 2,  'owner', 'Widow who inherited a vineyard-hotel estate outside Évora. She is wary of outsiders but generously rewarding to those she trusts.'),
('pedro_azevedo',   'owner',    'Pedro Azevedo',    'CEO, Azevedo Hospitality Group',        'Porto',    'visionary',   'hardball',      'PA', '#8b5cf6', 20, 5,  'owner', 'Self-made entrepreneur who built Porto''s most admired boutique collection. He tests advisors harshly before letting them near his portfolio.'),
('isabel_ferreira', 'owner',    'Isabel Ferreira',  'Proprietor, Ferreira Palace Collection','Lisboa',   'charming',    'intuitive',     'IF', '#f97316', 45, 8,  'owner', 'Custodian of three palace-hotels in Lisbon''s historic Alfama. Deeply protective of her legacy — any advisor must share her reverence for the properties.'),

-- BROKERS
('tiago_santos',    'broker',   'Tiago Santos',     'Senior Broker, Savills Portugal',       'Lisboa',   'charming',    'collaborative', 'TS', '#f59e0b', 50, 1,  'market', 'Lisbon''s most connected hotel broker. Knows everyone and everything — but charges accordingly. A good relationship unlocks off-market flow.'),
('vera_lopes',      'broker',   'Vera Lopes',       'Director, JLL Hotels Portugal',         'Porto',    'analytical',  'data_driven',   'VL', '#06b6d4', 45, 2,  'market', 'Data-obsessed broker who publishes Portugal''s most-read hotel market report. Work with her and your market credibility soars.'),
('joao_melo',       'broker',   'João Melo',        'Independent Broker',                    'Algarve',  'pragmatic',   'intuitive',     'JM', '#10b981', 35, 3,  'market', 'Ex-Cushman broker who went independent to work on higher-value transactions. Loose network but access to the most discreet sellers.'),

-- DEVELOPERS
('ricardo_pinto',   'developer','Ricardo Pinto',    'CEO, Arco Development Group',           'Lisboa',   'visionary',   'hardball',      'RP', '#f97316', 20, 4,  'market', 'The most active hotel developer in Lisbon. Brilliant and unpredictable — partnerships with him can make or break a career.'),
('clara_oliveira',  'developer','Clara Oliveira',   'Director, Douro Valley Properties',     'Porto',    'analytical',  'collaborative', 'CO', '#3b82f6', 30, 5,  'market', 'Specialist in adaptive reuse of historic buildings for boutique hotels. Thorough and methodical — she respects preparation above all.'),

-- OPERATORS
('hugo_silva',      'operator', 'Hugo Silva',       'Country Director, Selina Portugal',     'Lisboa',   'charming',    'collaborative', 'HS', '#10b981', 40, 2,  'operator', 'Runs the fastest-growing lifestyle operator in Portugal. Young, ambitious, and genuinely excited about good deals — refreshingly un-corporate.'),
('marta_bastos',    'operator', 'Marta Bastos',     'VP Development, NH Hotels Iberia',      'Porto',    'analytical',  'data_driven',   'MB', '#3b82f6', 30, 4,  'operator', 'NH Hotels'' expansion lead for Portugal. Conservative with commitments but once signed, she delivers — and the brand adds serious asset value.'),
('nuno_tavares',    'operator', 'Nuno Tavares',     'Founder, Rota Boutique Management',     'Algarve',  'pragmatic',   'intuitive',     'NT', '#f59e0b', 35, 3,  'operator', 'Built Portugal''s most respected independent hotel management firm from scratch. Dislikes big promises — he wants operators who understand his model.'),

-- COMPETITORS
('diogo_carvalho',  'competitor','Diogo Carvalho',  'Partner, Carvalho & Associados',        'Lisboa',   'aggressive',  'hardball',      'DC', '#ef4444', 10, 3,  'market', 'Your main rival in the Lisbon market. Well-connected and ruthless — he''ll poach clients and undercut fees without hesitation.'),
('beatriz_alves',   'competitor','Beatriz Alves',   'Director, Alves Advisory Group',        'Porto',    'pragmatic',   'collaborative', 'BA', '#64748b', 15, 5,  'market', 'Controls Porto''s advisory scene. Surprisingly willing to co-advise on larger deals — but only from a position of advantage.'),
('jorge_machado',   'competitor','Jorge Machado',   'CEO, Machado Hotel Consultancy',        'Algarve',  'charming',    'emotional',     'JA', '#8b5cf6', 20, 7,  'market', 'Southern Portugal''s dominant advisor. Charismatic and well-liked — harder to displace than to compete with directly.')

ON CONFLICT (slug) DO NOTHING;
