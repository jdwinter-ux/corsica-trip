import { supabase } from './supabase';

// Durable offline queue for editable plan items (IndexedDB). Mirrors
// notesQueue.js: items carry a stable id before they reach the server, so sync
// is idempotent (upsert onConflict:id) and realtime de-dup is trivial.
//
// Plan items are mutable (unlike append-only notes), so a queued upsert always
// carries the item's LATEST field values — re-queuing the same id just overwrites
// the pending copy, and the flush upserts (NOT ignoreDuplicates) so edits win.

// Its own DB so it never has to coordinate a version bump with notesQueue
// (same reasoning as photoQueue).
const DB_NAME = 'aeolian-offline-plan';
const STORE = 'pending_plan_items';
const DB_VERSION = 1;

const hasIDB = () => typeof indexedDB !== 'undefined';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// Persist a pending plan item (upsert). Throws if IndexedDB is unavailable so
// the caller can surface an error.
export async function queuePlanItem(item) {
  if (!hasIDB()) throw new Error('Offline storage unavailable');
  const db = await openDB();
  try {
    const t = db.transaction(STORE, 'readwrite');
    // Never persist the transient _seed/_pending UI flags.
    const clean = { ...item };
    delete clean._seed;
    delete clean._pending;
    t.objectStore(STORE).put(clean);
    await txDone(t);
  } finally {
    db.close();
  }
}

async function getAllPlanItems() {
  if (!hasIDB()) return [];
  const db = await openDB();
  try {
    const t = db.transaction(STORE, 'readonly');
    return (await reqToPromise(t.objectStore(STORE).getAll())) || [];
  } finally {
    db.close();
  }
}

export async function getQueuedPlanItemsForDay(dayNumber) {
  try {
    const all = await getAllPlanItems();
    return all.filter((it) => it.day_number === dayNumber);
  } catch {
    return [];
  }
}

export async function unqueuePlanItem(id) {
  if (!hasIDB()) return;
  const db = await openDB();
  try {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).delete(id);
    await txDone(t);
  } finally {
    db.close();
  }
}

// Push all queued plan items to Supabase. Idempotent upsert (edits overwrite);
// synced items are removed from the queue, failures stay for the next attempt.
// Coalesced so overlapping callers share one in-flight run.
let flushing = null;
export function flushPlanItems() {
  if (flushing) return flushing;
  flushing = doFlush().finally(() => { flushing = null; });
  return flushing;
}

async function doFlush() {
  if (!hasIDB()) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

  let all;
  try {
    all = await getAllPlanItems();
  } catch {
    return 0;
  }

  let synced = 0;
  for (const item of all) {
    try {
      const { error } = await supabase
        .from('trip_plan_items')
        .upsert(item, { onConflict: 'id' });
      if (!error) {
        await unqueuePlanItem(item.id);
        synced++;
      }
      // on error: leave queued for the next flush
    } catch (e) {
      console.debug('Flush plan item failed:', e?.message);
    }
  }
  return synced;
}
