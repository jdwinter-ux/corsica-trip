import { supabase } from './supabase';
import { newId } from './id';

// Durable offline queue for trip notes (IndexedDB). Notes are created with a
// client-generated UUID so they have their final id before they ever reach the
// server — making realtime de-dup trivial and sync idempotent (upsert).

const DB_NAME = 'aeolian-offline';
const STORE = 'pending_notes';
const DB_VERSION = 1;

const hasIDB = () => typeof indexedDB !== 'undefined';

export { newId }; // re-exported for existing importers (PlacesTab)

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

// Persist a pending note (throws if IndexedDB is unavailable, so the caller can
// fall back to surfacing an error).
export async function queueNote(note) {
  if (!hasIDB()) throw new Error('Offline storage unavailable');
  const db = await openDB();
  try {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(note);
    await txDone(t);
  } finally {
    db.close();
  }
}

async function getAllNotes() {
  if (!hasIDB()) return [];
  const db = await openDB();
  try {
    const t = db.transaction(STORE, 'readonly');
    return (await reqToPromise(t.objectStore(STORE).getAll())) || [];
  } finally {
    db.close();
  }
}

export async function getQueuedNotesForDay(dayNumber) {
  try {
    const all = await getAllNotes();
    return all.filter((n) => n.day_number === dayNumber);
  } catch {
    return [];
  }
}

export async function unqueueNote(id) {
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

// Push all queued notes to Supabase. Idempotent: upsert with ignoreDuplicates
// means a retry (or a crash mid-sync) can never create a duplicate. Succeeded
// notes are removed from the queue; failures stay for the next attempt.
//
// Coalesced: overlapping callers (e.g. app mount + the 'online' event firing
// together) share one in-flight run instead of double-processing the queue.
let flushing = null;
export function flushNotes() {
  if (flushing) return flushing;
  flushing = doFlush().finally(() => { flushing = null; });
  return flushing;
}

async function doFlush() {
  if (!hasIDB()) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

  let all;
  try {
    all = await getAllNotes();
  } catch {
    return 0;
  }

  let synced = 0;
  for (const note of all) {
    try {
      const { error } = await supabase
        .from('trip_notes')
        .upsert(note, { onConflict: 'id', ignoreDuplicates: true });
      if (!error) {
        await unqueueNote(note.id);
        synced++;
      }
      // on error: leave queued for the next flush
    } catch (e) {
      // network/SDK throw or unqueue failure — leave queued, never reject
      console.debug('Flush note failed:', e?.message);
    }
  }
  return synced;
}
