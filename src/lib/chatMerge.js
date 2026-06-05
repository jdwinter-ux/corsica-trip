/**
 * Merge a chat message (a persisted row, or a freshly-built optimistic one) into
 * the existing list without creating duplicates. Used by both the optimistic
 * send path and the Realtime subscription, which can race each other.
 *
 * Rules:
 *  1. If a message with the same `id` already exists, return the list unchanged.
 *  2. Otherwise, if an unconfirmed optimistic placeholder (id starting with
 *     `temp-` or `assistant-`) matches on role + content + author, replace it in
 *     place (reconciling the optimistic message with its persisted version).
 *     Matching on author too prevents a different traveler's identical-text
 *     message (the chat channel is unfiltered) from hijacking our pending one.
 *  3. Otherwise append it.
 * The result is always ordered by `created_at` ascending.
 *
 * Pure function — no React/Supabase dependencies — so it can be unit tested.
 */
export function mergeMessage(messages, row) {
  if (messages.some(m => m.id === row.id)) return messages;

  const idx = messages.findIndex(m =>
    typeof m.id === 'string' &&
    (m.id.startsWith('temp-') || m.id.startsWith('assistant-')) &&
    m.role === row.role &&
    m.content === row.content &&
    (m.author_email ?? null) === (row.author_email ?? null)
  );

  const merged = idx !== -1
    ? messages.map((m, i) => (i === idx ? row : m))
    : [...messages, row];

  return merged
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}
