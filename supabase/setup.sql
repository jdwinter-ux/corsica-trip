-- ============================================================================
-- One-shot Supabase setup for a fresh trip-journal project (a fork).
-- Run this once in the Supabase SQL Editor on a NEW project. It is idempotent,
-- so re-running is safe. (The per-feature files in migrations/ are kept only as
-- history — this file is the authoritative, complete schema.)
--
-- Covers: tables + RLS, storage buckets + policies, realtime publication, and
-- an optional traveler seed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- Photos with AI-identified metadata
CREATE TABLE IF NOT EXISTS trip_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number    INTEGER NOT NULL,
  author_email  TEXT,
  storage_path  TEXT NOT NULL,
  title         TEXT,
  location      TEXT,
  description   TEXT,
  tags          TEXT[] DEFAULT '{}',
  category      TEXT,
  people        TEXT[] DEFAULT '{}',   -- structured identified people
  verified      BOOLEAN DEFAULT false, -- true once a human edits/confirms
  identified_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trip_photos_day ON trip_photos(day_number);
CREATE INDEX IF NOT EXISTS idx_trip_photos_created_at ON trip_photos(created_at);

-- Per-day shared journal notes
CREATE TABLE IF NOT EXISTS trip_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number    INTEGER NOT NULL,
  author_email  TEXT,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trip_notes_day ON trip_notes(day_number);

-- Shared AI chat conversation (Marco)
CREATE TABLE IF NOT EXISTS trip_chat (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  author_email  TEXT,           -- NULL for assistant messages
  content       TEXT NOT NULL,
  attachments   JSONB,          -- [{name, storage_path, type}]
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trip_chat_created_at ON trip_chat(created_at);

-- Travelers (guests + crew), used for photo identification context
CREATE TABLE IF NOT EXISTS trip_travelers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  role            TEXT,
  description     TEXT,
  email           TEXT,
  reference_paths TEXT[] DEFAULT '{}', -- headshot storage paths (photos bucket)
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- The app is gated by a shared passcode, so any authenticated member may
-- read/write trip data. (Server-side functions use the service role and bypass
-- RLS regardless.) Re-runnable: policies are dropped first.
-- ----------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['trip_photos','trip_notes','trip_chat','trip_travelers'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth read %1$s" ON %1$I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth write %1$s" ON %1$I;', t);
    EXECUTE format('CREATE POLICY "auth read %1$s" ON %1$I FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "auth write %1$s" ON %1$I FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Storage buckets (public read so <img> URLs work; authenticated write)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read trip storage" ON storage.objects;
CREATE POLICY "Public read trip storage" ON storage.objects FOR SELECT TO public
  USING (bucket_id IN ('photos', 'chat-attachments'));

DROP POLICY IF EXISTS "Auth write trip storage" ON storage.objects;
CREATE POLICY "Auth write trip storage" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('photos', 'chat-attachments'));

DROP POLICY IF EXISTS "Auth delete trip storage" ON storage.objects;
CREATE POLICY "Auth delete trip storage" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('photos', 'chat-attachments'));

-- ----------------------------------------------------------------------------
-- Realtime: stream live changes for notes, photos, and chat
-- ----------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['trip_notes','trip_photos','trip_chat'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', t);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Optional: seed initial crew/travelers. Edit for your trip, or delete.
-- ----------------------------------------------------------------------------
-- INSERT INTO trip_travelers (name, role, description) VALUES
--   ('Captain', 'captain', 'Captain of the vessel'),
--   ('Chef',    'chef',    'Chef aboard');
