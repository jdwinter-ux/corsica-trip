// One-off: wipe chat history for a trip app (messages + attachment files).
// Usage: SB_URL=... SB_KEY=<service_role> node scripts/reset-chat.mjs
// The service_role key bypasses RLS — keep it out of the client/repo.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SB_URL;
const key = process.env.SB_KEY;
if (!url || !key) {
  console.error('Set SB_URL and SB_KEY (service_role) env vars.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

// 1) Delete all chat rows. supabase-js requires a filter, so match all ids.
const { error: delErr, count } = await sb
  .from('trip_chat')
  .delete({ count: 'exact' })
  .not('id', 'is', null);
if (delErr) {
  console.error('Failed to delete trip_chat rows:', delErr.message);
  process.exit(1);
}
console.log(`Deleted ${count ?? 0} chat message(s).`);

// 2) Empty the chat-attachments bucket (files are stored flat at the root).
const { data: files, error: listErr } = await sb.storage
  .from('chat-attachments')
  .list('', { limit: 1000 });
if (listErr) {
  console.error('Failed to list chat-attachments:', listErr.message);
  process.exit(1);
}
const paths = (files ?? []).filter((f) => f.id).map((f) => f.name);
if (paths.length) {
  const { error: rmErr } = await sb.storage.from('chat-attachments').remove(paths);
  if (rmErr) {
    console.error('Failed to remove attachment files:', rmErr.message);
    process.exit(1);
  }
}
console.log(`Removed ${paths.length} attachment file(s).`);
console.log('Chat reset complete.');
