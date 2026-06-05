-- Create trip_chat table for shared AI chat conversation
CREATE TABLE trip_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  author_email TEXT,  -- NULL for assistant messages
  content TEXT NOT NULL,
  attachments JSONB,  -- For uploaded docs/images: [{name, storage_path, type}]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE trip_chat ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all chat messages
CREATE POLICY "Authenticated users can read all chat"
  ON trip_chat FOR SELECT TO authenticated USING (true);

-- Policy: Authenticated users can insert chat messages
CREATE POLICY "Authenticated users can insert chat"
  ON trip_chat FOR INSERT TO authenticated
  WITH CHECK (true);

-- Create index for efficient ordering by created_at
CREATE INDEX idx_trip_chat_created_at ON trip_chat(created_at);
