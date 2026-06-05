-- Photo identification editing + reference-headshot recognition + feedback loop.
-- Run once in the Supabase SQL Editor. Idempotent.

-- trip_photos: structured people list + human-verified flag
ALTER TABLE trip_photos ADD COLUMN IF NOT EXISTS people TEXT[] DEFAULT '{}';
ALTER TABLE trip_photos ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- trip_travelers: uploaded reference headshot paths (in the public `photos` bucket)
ALTER TABLE trip_travelers ADD COLUMN IF NOT EXISTS reference_paths TEXT[] DEFAULT '{}';

-- Allow authenticated members to UPDATE photos (corrections) and travelers
-- (descriptions + reference photos). Re-runnable.
DROP POLICY IF EXISTS "auth update trip_photos" ON trip_photos;
CREATE POLICY "auth update trip_photos" ON trip_photos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth update trip_travelers" ON trip_travelers;
CREATE POLICY "auth update trip_travelers" ON trip_travelers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Members also need to read/insert travelers from the new management modal.
DROP POLICY IF EXISTS "auth read trip_travelers" ON trip_travelers;
CREATE POLICY "auth read trip_travelers" ON trip_travelers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth insert trip_travelers" ON trip_travelers;
CREATE POLICY "auth insert trip_travelers" ON trip_travelers
  FOR INSERT TO authenticated WITH CHECK (true);
