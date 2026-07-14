// Helpers for the editable "Day at a Glance" plan.
//
// The static per-day timeline in src/data/trip.js is the SEED for a day. Until
// someone edits that day, we display the seed; the first edit "materializes" the
// day into trip_plan_items using the deterministic ids below, so two travelers
// editing the same untouched day at once produce identical rows (upsert de-dups)
// instead of duplicating the timeline.

const POSITION_STEP = 10; // gaps between positions leave room to reorder

// Deterministic, valid-UUID id for a seeded item. Stable across clients and
// reloads: same (day, index) -> same id. Encodes day*1000+index in the final
// UUID segment (decimal digits are valid hex; well under the 12-char field).
export function seedItemId(dayNumber, index) {
  const tail = String(dayNumber * 1000 + index).padStart(12, '0');
  return `a0e01a00-0000-4000-8000-${tail}`;
}

// Build the seed plan items for a day from its static trip.js timeline.
// `_seed: true` marks rows that only exist client-side (not yet in the DB).
export function seedItemsForDay(day) {
  const timeline = Array.isArray(day?.timeline) ? day.timeline : [];
  return timeline.map(([time, what], i) => ({
    id: seedItemId(day.n, i),
    day_number: day.n,
    position: i * POSITION_STEP,
    time_label: time ?? '',
    what: what ?? '',
    author_email: null,
    _seed: true,
  }));
}

// Next position to append after the current list (keeps the STEP gaps).
export function nextPosition(items) {
  if (!items.length) return 0;
  return Math.max(...items.map((it) => it.position ?? 0)) + POSITION_STEP;
}

export { POSITION_STEP };
