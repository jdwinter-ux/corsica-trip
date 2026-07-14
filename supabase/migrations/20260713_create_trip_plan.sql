-- Editable "Day at a Glance" plan.
--
-- The per-day timeline used to be hard-coded in src/data/trip.js and baked into
-- the build — so once the trip started, nobody could adjust it from a phone when
-- reality diverged. This table makes the timeline a live, shared document.
--
-- Design: the static trip.js timeline is the SEED. A day shows its static
-- timeline until someone edits it, at which point the client "materializes" the
-- day's items into this table (with deterministic ids, so two people editing the
-- same untouched day at once can't create duplicates). From then on this table
-- is the source of truth for that day and streams live to everyone.

CREATE TABLE IF NOT EXISTS trip_plan_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number   INTEGER NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,  -- ordering within the day (ascending)
  time_label   TEXT,                        -- e.g. "~2 PM", "Morning", "Sunset"
  what         TEXT NOT NULL,               -- the activity description
  author_email TEXT,                        -- who last touched it
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trip_plan_items_day ON trip_plan_items(day_number);

-- RLS: any authenticated traveler may read/write (same open model as notes).
ALTER TABLE trip_plan_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read trip_plan_items" ON trip_plan_items;
DROP POLICY IF EXISTS "auth write trip_plan_items" ON trip_plan_items;
CREATE POLICY "auth read trip_plan_items" ON trip_plan_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write trip_plan_items" ON trip_plan_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Stream live changes to all travelers (idempotent add).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trip_plan_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trip_plan_items;
  END IF;
END $$;
