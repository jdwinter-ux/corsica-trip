import { supabase } from './supabase';
import { identifyPhoto } from './identify';

// Durable offline queue for photos (IndexedDB). Each entry stores the original
// image Blob plus metadata. Photos use a client-generated UUID and a storage
// path derived from it, so the multi-step sync (upload -> insert -> identify) is
// fully idempotent: a retry overwrites the same object/row instead of dupling.
// Uses its own DB so it never has to coordinate a version bump with notesQueue.

const DB_NAME = 'aeolian-offline-photos';
const STORE = 'pending_photos';
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

// Persist a pending photo. Throws (e.g. quota exceeded / no IndexedDB) so the
// caller can surface the failure.
export async function queuePhoto(entry) {
  if (!hasIDB()) throw new Error('Offline storage unavailable');
  const db = await openDB();
  try {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(entry);
    await txDone(t);
  } finally {
    db.close();
  }
}

async function getAllPhotos() {
  if (!hasIDB()) return [];
  const db = await openDB();
  try {
    const t = db.transaction(STORE, 'readonly');
    return (await reqToPromise(t.objectStore(STORE).getAll())) || [];
  } finally {
    db.close();
  }
}

export async function getQueuedPhotosForDay(dayNumber) {
  try {
    const all = await getAllPhotos();
    return all.filter((p) => p.day_number === dayNumber);
  } catch {
    return [];
  }
}

export async function unqueuePhoto(id) {
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

function photoRow(entry, path) {
  return {
    id: entry.id,
    day_number: entry.day_number,
    author_email: entry.author_email,
    storage_path: path,
    title: 'Identifying...',
    location: 'Analyzing photo',
    description: '',
    tags: [],
    category: 'landmark',
    created_at: entry.created_at,
  };
}

// Upload + insert each queued photo, then kick off identification. Coalesced so
// overlapping callers (mount + reconnect) share one run; never rejects.
let flushing = null;
export function flushPhotos() {
  if (flushing) return flushing;
  flushing = doFlush().finally(() => { flushing = null; });
  return flushing;
}

async function doFlush() {
  if (!hasIDB()) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

  let all;
  try {
    all = await getAllPhotos();
  } catch {
    return 0;
  }

  let synced = 0;
  for (const entry of all) {
    const path = `${entry.day_number}/${entry.id}.${entry.ext}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, entry.file, { upsert: true });
      if (uploadError) continue; // leave queued, retry next flush

      const { error: insertError } = await supabase
        .from('trip_photos')
        .upsert(photoRow(entry, path), { onConflict: 'id', ignoreDuplicates: true });
      if (insertError) continue;

      // Uploaded + row exists -> durable. Remove the blob from the queue.
      await unqueuePhoto(entry.id);
      synced++;

      // Identify is a best-effort follow-up; the existing "tap to retry" UI
      // handles a failure here.
      try {
        await identifyPhoto(entry.id, path, entry.day_context);
      } catch (e) {
        console.debug('Deferred identify failed:', e?.message);
      }
    } catch (e) {
      console.debug('Flush photo failed:', e?.message);
    }
  }
  // Tell any open PhotosTab to refetch — covers the case where the realtime
  // INSERT echo was missed (e.g. socket still reconnecting) so a pending tile
  // would otherwise keep its badge.
  if (synced > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('photos-synced'));
  }
  return synced;
}
