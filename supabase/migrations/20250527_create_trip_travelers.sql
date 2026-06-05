-- Trip travelers table for storing guests and crew
CREATE TABLE trip_travelers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT, -- 'guest', 'crew', 'captain', 'chef', etc.
  description TEXT, -- physical description or other identifying info
  email TEXT, -- optional, for linking to auth users
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE trip_travelers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read travelers"
  ON trip_travelers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert travelers"
  ON trip_travelers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update travelers"
  ON trip_travelers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete travelers"
  ON trip_travelers FOR DELETE TO authenticated USING (true);

-- Add some initial crew based on trip context
INSERT INTO trip_travelers (name, role, description) VALUES
  ('Captain', 'captain', 'Captain of M/Y TWINS'),
  ('Chef Salvo', 'chef', 'Chef aboard M/Y TWINS, Sicilian cuisine expert');
