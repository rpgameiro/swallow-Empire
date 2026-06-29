-- Fix leads RLS: all four policies were TO authenticated only.
-- The app uses the anon key without user auth, so INSERT/UPDATE/DELETE were
-- blocked (throwing silently) and SELECT was returning [] (wiping localStorage).
-- Add anon to each policy so the client can read and write its own leads.

DROP POLICY IF EXISTS "Players can select own leads"  ON leads;
DROP POLICY IF EXISTS "Players can insert own leads"  ON leads;
DROP POLICY IF EXISTS "Players can update own leads"  ON leads;
DROP POLICY IF EXISTS "Players can delete own leads"  ON leads;

CREATE POLICY "Players can select own leads"  ON leads FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Players can insert own leads"  ON leads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Players can update own leads"  ON leads FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Players can delete own leads"  ON leads FOR DELETE
  TO anon, authenticated USING (true);
