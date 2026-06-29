/*
  # Evolve existing office_upgrades schema

  The table already exists with columns:
    id (uuid), slug (text), name, description, cost, monthly_revenue_bonus,
    monthly_expense_cost, xp_bonus_pct, reputation_bonus, tier, required_level, icon

  Changes:
  1. Add `income_multiplier_bonus` (real) — fractional income multiplier per upgrade
  2. Add `required_slug` (text) — prerequisite upgrade slug
  3. Seed the four upgrade rows (Small Office → Meeting Room → Marketing Team → Investment Division)
  4. Fix player_office_upgrades so upgrade_id references by uuid correctly

  Note: player_office_upgrades.upgrade_id is already uuid → office_upgrades.id, which is fine.
*/

-- Add missing columns if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_upgrades' AND column_name = 'income_multiplier_bonus'
  ) THEN
    ALTER TABLE office_upgrades ADD COLUMN income_multiplier_bonus real NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_upgrades' AND column_name = 'required_slug'
  ) THEN
    ALTER TABLE office_upgrades ADD COLUMN required_slug text DEFAULT NULL;
  END IF;
END $$;

-- Seed upgrades (upsert by slug)
INSERT INTO office_upgrades (slug, name, description, tier, cost, reputation_bonus, income_multiplier_bonus, xp_bonus_pct, monthly_revenue_bonus, monthly_expense_cost, required_level, required_slug, icon)
VALUES
  ('small_office',
   'Small Office',
   'A modest serviced office in Lisbon. Your base of operations — where every empire begins.',
   1, 0, 10, 0.0, 0, 0, 0, 1, NULL, 'building2'),

  ('meeting_room',
   'Meeting Room',
   'A dedicated boardroom for client pitches and deal negotiations. Signals credibility to investors.',
   2, 25000, 20, 0.15, 5, 5000, 1000, 3, 'small_office', 'users'),

  ('marketing_team',
   'Marketing Team',
   'A small in-house team to generate inbound leads and amplify your advisory brand across Portugal.',
   3, 75000, 35, 0.30, 10, 15000, 3000, 8, 'meeting_room', 'megaphone'),

  ('investment_division',
   'Investment Division',
   'A fully staffed investment division with analysts, associates, and a managing director. Empire-tier infrastructure.',
   4, 200000, 75, 0.60, 20, 50000, 10000, 15, 'marketing_team', 'landmark')

ON CONFLICT (slug) DO UPDATE SET
  name                    = EXCLUDED.name,
  description             = EXCLUDED.description,
  tier                    = EXCLUDED.tier,
  cost                    = EXCLUDED.cost,
  reputation_bonus        = EXCLUDED.reputation_bonus,
  income_multiplier_bonus = EXCLUDED.income_multiplier_bonus,
  xp_bonus_pct            = EXCLUDED.xp_bonus_pct,
  monthly_revenue_bonus   = EXCLUDED.monthly_revenue_bonus,
  monthly_expense_cost    = EXCLUDED.monthly_expense_cost,
  required_level          = EXCLUDED.required_level,
  required_slug           = EXCLUDED.required_slug,
  icon                    = EXCLUDED.icon;
