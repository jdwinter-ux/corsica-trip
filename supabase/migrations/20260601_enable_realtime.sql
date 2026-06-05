-- Enable Supabase Realtime for the shared collaborative tables so that notes,
-- photos, and chat messages stream live to all travelers without a refresh.
--
-- These tables already grant SELECT to `authenticated` via RLS, which is what
-- Realtime requires to deliver row-change events. Default replica identity
-- (primary key) is sufficient — DELETE events carry the `id`, which is all the
-- client needs to remove a row.
--
-- Apply in Supabase: SQL Editor (run this), or Dashboard → Database →
-- Replication → enable trip_notes, trip_photos, trip_chat.

ALTER PUBLICATION supabase_realtime ADD TABLE trip_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_photos;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_chat;
