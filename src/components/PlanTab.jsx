import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtime } from '../lib/useRealtime';
import { useOnReconnect } from '../lib/useOnReconnect';
import { newId } from '../lib/id';
import {
  queuePlanItem,
  unqueuePlanItem,
  getQueuedPlanItemsForDay,
  flushPlanItems,
} from '../lib/planQueue';
import { seedItemsForDay, nextPosition } from '../lib/planItems';
import { THEME } from '../config/theme';

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0);

export default function PlanTab({ day, userEmail }) {
  const dayNumber = day?.n;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  // Refs so realtime/async handlers always see the latest without re-subscribing.
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  // Whether this day's plan is backed by DB rows (vs. still showing the static
  // seed). Once true, the DB is authoritative for the day.
  const materializedRef = useRef(false);
  // Holds the in-flight materialization promise so concurrent mutations wait for
  // the seed rows to finish writing before they touch the DB (single-flight).
  const materializingRef = useRef(null);

  // PlanTab is keyed by day in App, so it remounts on day change — no manual
  // state reset needed here; fetchPlan sets materializedRef in every branch.
  useEffect(() => {
    if (!dayNumber) return;
    const req = { active: true };
    fetchPlan(req);
    return () => { req.active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNumber]);

  // Live updates: plan edits by other travelers on this day.
  useRealtime(
    `plan-day-${dayNumber}`,
    dayNumber ? { table: 'trip_plan_items', filter: `day_number=eq.${dayNumber}` } : {},
    {
      onInsert: (row) => {
        materializedRef.current = true;
        setItems((prev) => {
          const idx = prev.findIndex((it) => it.id === row.id);
          // Replace a matching seed/optimistic copy (deterministic seed ids mean
          // a remote materialization lands right on our local seeds).
          if (idx !== -1) return prev.map((it, i) => (i === idx ? row : it));
          // First real row(s) arriving: drop any remaining client-only seeds.
          return [...prev.filter((it) => !it._seed), row];
        });
      },
      onUpdate: (row) => {
        materializedRef.current = true;
        setItems((prev) => prev.map((it) => {
          if (it.id !== row.id) return it;
          // Don't overwrite a row the user is mid-editing locally (unsynced) —
          // our own save will echo back and reconcile it.
          if (it._pending) return it;
          return row;
        }));
      },
      onDelete: (oldRow) =>
        setItems((prev) => prev.filter((it) => it.id !== oldRow.id)),
    }
  );

  // Recover anything missed while offline, and push queued edits.
  useOnReconnect(() => {
    if (dayNumber) fetchPlan();
    flushPlanItems();
  });

  async function fetchPlan(req = { active: true }) {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('trip_plan_items')
      .select('*')
      .eq('day_number', dayNumber)
      .order('position', { ascending: true });

    if (!req.active) return; // a newer day was selected; drop this stale result

    const queued = await getQueuedPlanItemsForDay(dayNumber);
    if (!req.active) return;

    if (!e && data && data.length > 0) {
      // DB is authoritative. Overlay any still-unsynced local edits (pending).
      materializedRef.current = true;
      const byId = new Map(data.map((r) => [r.id, r]));
      for (const q of queued) byId.set(q.id, { ...q, _pending: true });
      setItems([...byId.values()]);
      setError('');
    } else if (queued.length > 0) {
      // No server rows yet, but we have offline edits waiting to sync.
      materializedRef.current = true;
      setItems(queued.map((q) => ({ ...q, _pending: true })));
      setError(e ? "Couldn't reach the server. Showing your saved edits." : '');
    } else {
      // Untouched day: show the static seed timeline.
      materializedRef.current = false;
      setItems(seedItemsForDay(day));
      setError(e ? "Couldn't load the latest plan. Showing the original." : '');
    }
    setLoading(false);
  }

  // Write the day's static seed into the DB the first time it's edited, so all
  // later edits operate on real rows. Deterministic seed ids + upsert make this
  // safe even if two travelers do it at the same moment.
  async function ensureMaterialized() {
    // Already done — but if a materialization is still in flight, wait for it so
    // callers never race ahead of the seed writes.
    if (materializedRef.current) {
      if (materializingRef.current) await materializingRef.current;
      return;
    }
    materializedRef.current = true;
    materializingRef.current = (async () => {
      const seeds = itemsRef.current.map((it) => {
        const r = { ...it };
        delete r._seed;
        return r;
      });
      setItems((prev) => prev.map((it) => ({ ...it, _seed: false, _pending: true })));
      for (const row of seeds) await persistItem(row);
    })();
    try {
      await materializingRef.current;
    } finally {
      materializingRef.current = null;
    }
  }

  // Optimistic upsert with the app's offline fallback: queue when offline, and
  // surface a message on a genuine online failure. Clears the pending badge on
  // success.
  async function persistItem(row) {
    const clean = { ...row, author_email: row.author_email ?? userEmail, updated_at: new Date().toISOString() };
    delete clean._seed;
    delete clean._pending;

    const { error: e } = await supabase
      .from('trip_plan_items')
      .upsert(clean, { onConflict: 'id' });

    if (!e) {
      setItems((prev) => prev.map((it) => (it.id === clean.id ? { ...it, _pending: false, _seed: false } : it)));
      return true;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await queuePlanItem(clean);
      } catch (qErr) {
        console.error('Queue plan item failed:', qErr);
        setError("Couldn't save your change offline on this device.");
      }
    } else {
      console.error('Save plan item error:', e);
      setError("Couldn't save that change. Please try again.");
    }
    return false;
  }

  function editField(id, field, value) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value, _pending: true } : it)));
  }

  async function commitField(id) {
    // Only write if this row actually has an unsaved change — a plain
    // focus/blur shouldn't materialize the day or fire a needless upsert.
    const current = itemsRef.current.find((it) => it.id === id);
    if (!current || !current._pending) return;
    await ensureMaterialized();
    const item = itemsRef.current.find((it) => it.id === id);
    if (item) await persistItem(item);
  }

  async function addItem() {
    await ensureMaterialized();
    const item = {
      id: newId(),
      day_number: dayNumber,
      position: nextPosition(itemsRef.current),
      time_label: '',
      what: '',
      author_email: userEmail,
    };
    setItems((prev) => [...prev, { ...item, _pending: true }]);
    await persistItem(item);
  }

  async function deleteItem(item) {
    await ensureMaterialized();
    await unqueuePlanItem(item.id).catch(() => {});
    setItems((prev) => prev.filter((it) => it.id !== item.id));

    const { error: e } = await supabase.from('trip_plan_items').delete().eq('id', item.id);
    if (e && !(typeof navigator !== 'undefined' && !navigator.onLine)) {
      console.error('Delete plan item error:', e);
      setError("Couldn't delete that item. Please try again.");
    }
  }

  async function moveItem(item, dir) {
    await ensureMaterialized();
    const ordered = [...itemsRef.current].sort(byPosition);
    const idx = ordered.findIndex((it) => it.id === item.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= ordered.length) return;

    const a = ordered[idx];
    const b = ordered[swapIdx];
    const aNext = { ...a, position: b.position, _pending: true };
    const bNext = { ...b, position: a.position, _pending: true };
    setItems((prev) => prev.map((it) => (it.id === a.id ? aNext : it.id === b.id ? bNext : it)));
    await persistItem(aNext);
    await persistItem(bNext);
  }

  if (!day) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: THEME.blueMuted }}>
        No plan available for this day.
      </div>
    );
  }

  const ordered = [...items].sort(byPosition);

  return (
    <div>
      {/* Header + edit toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <div style={{ fontSize: '0.75rem', color: THEME.blue, letterSpacing: '0.08em' }}>
          ⏱ THE DAY AT A GLANCE
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          style={{
            background: editing ? `linear-gradient(135deg, ${THEME.gold}, ${THEME.goldLight})` : 'none',
            border: `1px solid ${THEME.rgba(THEME.base.gold, editing ? 0.4 : 0.25)}`,
            borderRadius: '6px', padding: '0.3rem 0.8rem',
            color: editing ? THEME.bgDeep : THEME.blue,
            fontWeight: editing ? 700 : 400,
            fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em',
          }}
        >
          {editing ? '✓ Done' : '✎ Edit'}
        </button>
      </div>

      {error && (
        <div style={{
          background: THEME.rgba(THEME.base.red, 0.12),
          border: `1px solid ${THEME.rgba(THEME.base.red, 0.3)}`,
          borderRadius: '8px', padding: '0.6rem 0.9rem',
          color: THEME.error, fontSize: '0.78rem',
          marginBottom: '1rem', lineHeight: 1.5,
        }}>⚠️ {error}</div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: THEME.blueMuted, fontSize: '0.9rem' }}>
          Loading plan...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: editing ? '0.8rem' : '1.5rem' }}>
          {ordered.length === 0 && !editing && (
            <div style={{ color: THEME.blueDim, fontSize: '0.85rem', padding: '0.5rem 0' }}>
              Nothing planned yet. Tap ✎ Edit to add to the day.
            </div>
          )}
          {ordered.map((item, i) =>
            editing ? (
              <EditRow
                key={item.id}
                item={item}
                isFirst={i === 0}
                isLast={i === ordered.length - 1}
                onEdit={editField}
                onCommit={commitField}
                onMove={moveItem}
                onDelete={deleteItem}
              />
            ) : (
              <div key={item.id} style={{
                display: 'flex', gap: '0.8rem',
                background: THEME.rgba(THEME.base.white, 0.04),
                border: `1px solid ${THEME.rgba(THEME.base.gold, 0.1)}`,
                borderRadius: '8px', padding: '0.6rem 0.9rem',
              }}>
                <div style={{
                  color: THEME.gold, fontSize: '0.7rem', fontWeight: 700,
                  letterSpacing: '0.08em', minWidth: '90px', flexShrink: 0, paddingTop: '0.1rem',
                }}>
                  {(item.time_label || '').toUpperCase()}
                </div>
                <div style={{ color: THEME.sand, fontSize: '0.85rem', lineHeight: 1.5, flex: 1 }}>
                  {item.what}
                  {item._pending && (
                    <span style={{ color: THEME.goldMuted, fontSize: '0.65rem', marginLeft: '0.5rem' }}>
                      ⏳ syncing
                    </span>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {editing && (
        <button
          onClick={addItem}
          style={{
            width: '100%', marginBottom: '1.5rem',
            background: THEME.rgba(THEME.base.gold, 0.08),
            border: `1px dashed ${THEME.rgba(THEME.base.gold, 0.35)}`,
            borderRadius: '8px', padding: '0.7rem',
            color: THEME.gold, fontFamily: 'inherit', fontSize: '0.8rem',
            cursor: 'pointer', letterSpacing: '0.05em',
          }}
        >
          + Add to the day
        </button>
      )}

      {(day.activities?.hiker || day.activities?.biker) && (
        <>
          <div style={{ fontSize: '0.75rem', color: THEME.blue, marginBottom: '0.8rem', letterSpacing: '0.08em' }}>
            🥾 GET OUTSIDE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {day.activities.hiker && (
              <div style={{
                background: THEME.rgba(THEME.base.green, 0.08),
                border: `1px solid ${THEME.rgba(THEME.base.green, 0.2)}`,
                borderRadius: '10px', padding: '0.8rem 1rem',
              }}>
                <div style={{ fontSize: '0.7rem', color: THEME.green, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>
                  🥾 ON FOOT
                </div>
                <div style={{ color: THEME.sand, fontSize: '0.85rem', lineHeight: 1.5 }}>{day.activities.hiker}</div>
              </div>
            )}
            {day.activities.biker && (
              <div style={{
                background: THEME.rgba(THEME.base.blueMarker, 0.08),
                border: `1px solid ${THEME.rgba(THEME.base.blueMarker, 0.2)}`,
                borderRadius: '10px', padding: '0.8rem 1rem',
              }}>
                <div style={{ fontSize: '0.7rem', color: THEME.blueAccent, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>
                  🚴 BY E-BIKE
                </div>
                <div style={{ color: THEME.sand, fontSize: '0.85rem', lineHeight: 1.5 }}>{day.activities.biker}</div>
              </div>
            )}
          </div>
        </>
      )}

      {day.activities?.rendezvous && (
        <div style={{
          background: THEME.rgba(THEME.base.goldDeep, 0.06),
          border: `1px solid ${THEME.rgba(THEME.base.goldDeep, 0.2)}`,
          borderRadius: '10px', padding: '0.8rem 1rem', marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '0.7rem', color: THEME.gold, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>
            📍 DON'T MISS
          </div>
          <div style={{ color: THEME.sand, fontSize: '0.85rem', lineHeight: 1.5 }}>{day.activities.rendezvous}</div>
        </div>
      )}

      {day.meals && (
        <>
          <div style={{ fontSize: '0.75rem', color: THEME.blue, marginBottom: '0.8rem', letterSpacing: '0.08em' }}>
            🍽 MEALS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{
              background: THEME.rgba(THEME.base.white, 0.04),
              border: `1px solid ${THEME.rgba(THEME.base.gold, 0.1)}`,
              borderRadius: '8px', padding: '0.6rem 0.9rem',
              display: 'flex', gap: '0.8rem',
            }}>
              <div style={{ color: THEME.gold, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', minWidth: '60px', paddingTop: '0.1rem' }}>LUNCH</div>
              <div style={{ color: THEME.sand, fontSize: '0.85rem' }}>{day.meals.lunch}</div>
            </div>
            <div style={{
              background: THEME.rgba(THEME.base.white, 0.04),
              border: `1px solid ${THEME.rgba(THEME.base.gold, 0.1)}`,
              borderRadius: '8px', padding: '0.6rem 0.9rem',
              display: 'flex', gap: '0.8rem',
            }}>
              <div style={{ color: THEME.gold, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', minWidth: '60px', paddingTop: '0.1rem' }}>DINNER</div>
              <div style={{ color: THEME.sand, fontSize: '0.85rem' }}>{day.meals.dinner}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// A single editable timeline row: time label + description, with reorder and
// delete controls. Edits commit on blur (persist), keeping keystrokes local.
function EditRow({ item, isFirst, isLast, onEdit, onCommit, onMove, onDelete }) {
  const inputStyle = {
    background: THEME.rgba(THEME.base.white, 0.06),
    border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
    borderRadius: '6px', padding: '0.4rem 0.6rem',
    color: THEME.parchment, fontFamily: 'inherit', outline: 'none',
  };
  const iconBtn = (enabled) => ({
    background: 'none', border: 'none',
    color: enabled ? THEME.blue : THEME.blueDim,
    cursor: enabled ? 'pointer' : 'default',
    fontSize: '0.9rem', padding: '0.15rem 0.35rem', lineHeight: 1,
    opacity: enabled ? 1 : 0.4,
  });

  return (
    <div style={{
      background: THEME.rgba(THEME.base.white, 0.04),
      border: `1px solid ${THEME.rgba(THEME.base.gold, 0.15)}`,
      borderRadius: '8px', padding: '0.6rem 0.7rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <input
          value={item.time_label || ''}
          onChange={(e) => onEdit(item.id, 'time_label', e.target.value)}
          onBlur={() => onCommit(item.id)}
          placeholder="Time"
          style={{ ...inputStyle, width: '90px', flexShrink: 0, fontSize: '0.7rem', fontWeight: 700, color: THEME.gold, letterSpacing: '0.05em' }}
        />
        <textarea
          value={item.what || ''}
          onChange={(e) => onEdit(item.id, 'what', e.target.value)}
          onBlur={() => onCommit(item.id)}
          placeholder="What's happening…"
          rows={2}
          style={{ ...inputStyle, flex: 1, fontSize: '0.85rem', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          <button onClick={() => onMove(item, 'up')} disabled={isFirst} style={iconBtn(!isFirst)} title="Move up">↑</button>
          <button onClick={() => onMove(item, 'down')} disabled={isLast} style={iconBtn(!isLast)} title="Move down">↓</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {item._pending && <span style={{ color: THEME.goldMuted, fontSize: '0.65rem' }}>⏳ syncing</span>}
          <button onClick={() => onDelete(item)} style={{ background: 'none', border: 'none', color: THEME.blueMuted, cursor: 'pointer', fontSize: '0.8rem', padding: '0.15rem 0.35rem' }} title="Remove">✕</button>
        </div>
      </div>
    </div>
  );
}
