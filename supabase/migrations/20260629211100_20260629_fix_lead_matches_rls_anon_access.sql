-- Fix lead_matches RLS: all policies were TO authenticated only.
-- App uses anon key without auth, so SELECT returned [] and INSERT/UPDATE
-- threw silently, leaving the Run Match Engine button stuck on "Running…".
-- Mirror the authless prototype pattern already accepted for leads.

DROP POLICY IF EXISTS "Players can select own matches" ON lead_matches;
DROP POLICY IF EXISTS "Players can insert own matches" ON lead_matches;
DROP POLICY IF EXISTS "Players can update own matches" ON lead_matches;

CREATE POLICY "Players can select own matches" ON lead_matches FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Players can insert own matches" ON lead_matches FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Players can update own matches" ON lead_matches FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
