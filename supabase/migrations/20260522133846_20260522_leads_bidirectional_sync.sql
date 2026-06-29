/*
  # Leads Bidirectional Sync Foundation

  ## Summary
  Adds new columns to the `leads` table and creates the `lead_events` audit table
  to support bidirectional synchronization between Notion, Supabase, and the Bolt UI.

  ## Changes to `leads` table
  - `stars` (int, default 0): Star rating assigned in Bolt UI (1-5)
  - `rooms` (int, nullable): Number of rooms (from Notion "Nº Quartos" property)
  - `last_contact_at` (timestamptz, nullable): Date of last contact with lead
  - `next_follow_up` (timestamptz, nullable): Scheduled next follow-up date
  - `status_updated_at` (timestamptz, nullable): Auto-set when status changes
  - `notion_last_synced_at` (timestamptz, nullable): When the record was last synced FROM Notion
  - `bolt_last_updated_at` (timestamptz, nullable): When the record was last updated IN Bolt

  ## New table: `lead_events`
  Audit trail for status changes and important lead lifecycle events.
  - `id` (uuid, pk)
  - `lead_id` (uuid, fk → leads.id)
  - `player_id` (uuid, fk → players.id)
  - `event_type` (text): 'status_change', 'notion_sync', 'bolt_update', 'match_created'
  - `old_value` (text, nullable): Previous value
  - `new_value` (text, nullable): New value
  - `created_at` (timestamptz)

  ## Triggers
  - `set_status_updated_at`: Auto-updates `status_updated_at` when `status` column changes

  ## Security
  - RLS enabled on `lead_events`
  - Users can only read/write their own lead events (via player_id)
*/

-- ─── Add new columns to leads ──────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'stars') THEN
    ALTER TABLE leads ADD COLUMN stars integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'rooms') THEN
    ALTER TABLE leads ADD COLUMN rooms integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'last_contact_at') THEN
    ALTER TABLE leads ADD COLUMN last_contact_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'next_follow_up') THEN
    ALTER TABLE leads ADD COLUMN next_follow_up timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'status_updated_at') THEN
    ALTER TABLE leads ADD COLUMN status_updated_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'notion_last_synced_at') THEN
    ALTER TABLE leads ADD COLUMN notion_last_synced_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'bolt_last_updated_at') THEN
    ALTER TABLE leads ADD COLUMN bolt_last_updated_at timestamptz;
  END IF;
END $$;

-- ─── Auto-update status_updated_at trigger ────────────────────────────────────

CREATE OR REPLACE FUNCTION update_lead_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_lead_status_updated_at ON leads;
CREATE TRIGGER set_lead_status_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_status_timestamp();

-- ─── lead_events audit table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  player_id   uuid NOT NULL,
  event_type  text NOT NULL CHECK (event_type IN ('status_change', 'notion_sync', 'bolt_update', 'match_created')),
  old_value   text,
  new_value   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_events_lead_id_idx ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS lead_events_player_id_idx ON lead_events(player_id);
CREATE INDEX IF NOT EXISTS lead_events_created_at_idx ON lead_events(created_at DESC);

ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lead events"
  ON lead_events FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Users can insert own lead events"
  ON lead_events FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid());
