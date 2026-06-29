/*
  # Allow anon read on official_quests

  Adds a SELECT policy for the anon role so unauthenticated clients
  (the game frontend) can read official quests without an auth session.
*/

CREATE POLICY "Allow anon read official quests"
  ON public.official_quests
  FOR SELECT
  TO anon
  USING (true);
