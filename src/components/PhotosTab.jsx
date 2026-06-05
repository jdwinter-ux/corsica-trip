import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtime } from '../lib/useRealtime';
import { useOnReconnect } from '../lib/useOnReconnect';
import { identifyPhoto } from '../lib/identify';
import { newId } from '../lib/id';
import { queuePhoto, getQueuedPhotosForDay, unqueuePhoto } from '../lib/photoQueue';
import { CATEGORY_ICONS } from '../data/trip';
import { THEME } from '../config/theme';

function truncateEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 6)}...@${domain}`;
}

export default function PhotosTab({ day, userEmail }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const dayNumber = day?.n;

  // Mirror of `photos` for reading current state outside the render/updater
  // (used to revoke object URLs as a side effect, never inside a setState updater).
  const photosRef = useRef([]);
  useEffect(() => { photosRef.current = photos; }, [photos]);

  useEffect(() => {
    if (!dayNumber) return;
    const req = { active: true };
    fetchPhotos(req);
    // Ignore an in-flight fetch's result if the day changes before it resolves
    return () => { req.active = false; };
  }, [dayNumber]);

  // Live updates: photos added/identified/removed by other travelers on this day
  useRealtime(
    `photos-day-${dayNumber}`,
    dayNumber ? { table: 'trip_photos', filter: `day_number=eq.${dayNumber}` } : {},
    {
      onInsert: (row) => {
        // Release a synced pending photo's object URL OUTSIDE the updater
        // (updaters are double-invoked under StrictMode — no side effects there).
        const existing = photosRef.current.find(p => p.id === row.id);
        if (existing?._objectUrl) URL.revokeObjectURL(existing._objectUrl);
        setPhotos(prev => {
          if (prev.some(p => p.id === row.id)) {
            return prev.map(p => (p.id === row.id ? { ...row, _loading: !row.identified_at } : p));
          }
          // Show a spinner for photos still awaiting AI identification
          return [{ ...row, _loading: !row.identified_at }, ...prev];
        });
      },
      onUpdate: (row) =>
        setPhotos(prev => prev.map(p =>
          p.id === row.id ? { ...p, ...row, _loading: false, _failed: false } : p
        )),
      onDelete: (oldRow) =>
        setPhotos(prev => prev.filter(p => p.id !== oldRow.id)),
    }
  );

  // Refetch this day's photos after a reconnect to catch anything missed offline
  useOnReconnect(() => {
    if (dayNumber) fetchPhotos();
  });

  // Refetch when the offline queue finishes syncing (covers a missed realtime echo)
  useEffect(() => {
    const handler = () => { if (dayNumber) fetchPhotos(); };
    window.addEventListener('photos-synced', handler);
    return () => window.removeEventListener('photos-synced', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNumber]);

  // Revoke any outstanding object URLs (for pending offline photos) on unmount
  useEffect(() => () => {
    photosRef.current.forEach(p => p._objectUrl && URL.revokeObjectURL(p._objectUrl));
  }, []);

  if (!day || !dayNumber) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: THEME.blueMuted }}>
        No day selected.
      </div>
    );
  }

  async function fetchPhotos(req = { active: true }) {
    setLoading(true);
    const { data, error } = await supabase
      .from('trip_photos')
      .select('*')
      .eq('day_number', day.n)
      .order('created_at', { ascending: false });

    if (!req.active) return; // a newer day was selected; drop this stale result

    // Photos captured offline (not yet uploaded) are shown from local blobs
    const queued = await getQueuedPhotosForDay(day.n);
    if (!req.active) return;

    // Compute the merge against the latest committed state. All object-URL
    // create/revoke side effects happen HERE (never inside a setState updater,
    // which StrictMode double-invokes).
    const prev = photosRef.current;
    let serverPhotos;
    if (!error && data) {
      const now = new Date();
      serverPhotos = data.map(photo => {
        const ageMinutes = (now - new Date(photo.created_at)) / 1000 / 60;
        const needsRetry = !photo.identified_at && ageMinutes > 2;
        return {
          ...photo,
          _failed: needsRetry,
          title: needsRetry ? (photo.title === 'Identifying...' ? 'Photo' : photo.title) : photo.title,
          description: needsRetry ? 'Identification failed — tap to retry.' : photo.description,
        };
      });
    } else {
      // Offline/failed fetch — keep the server photos we already had
      serverPhotos = prev.filter(p => !p._pending);
      console.error('Fetch photos error:', error);
    }

    const have = new Set(serverPhotos.map(p => p.id));
    // Carry over current-day pending photos (keep their existing object URLs)
    const localPending = prev.filter(p => p._pending && p.day_number === day.n && !have.has(p.id));
    const localIds = new Set(localPending.map(p => p.id));
    const seen = new Set([...have, ...localIds]);
    // Restore any queued photos not already shown (e.g. after a reload)
    const queuedNew = queued.filter(q => !seen.has(q.id)).map(pendingPhotoFromEntry);

    // Release object URLs from the previous list that we're not carrying over
    prev.forEach(p => {
      if (p._objectUrl && !localIds.has(p.id)) URL.revokeObjectURL(p._objectUrl);
    });

    setPhotos([...queuedNew, ...localPending, ...serverPhotos]);
    setLoading(false);
  }

  function getPhotoUrl(storagePath) {
    return `${supabaseUrl}/storage/v1/object/public/photos/${storagePath}`;
  }

  // Build a display photo (with a local object URL) from a queued offline entry
  function pendingPhotoFromEntry(entry) {
    return {
      id: entry.id,
      day_number: entry.day_number,
      author_email: entry.author_email,
      storage_path: `${entry.day_number}/${entry.id}.${entry.ext}`,
      title: 'Saved offline',
      location: '',
      description: "Will upload when you're back online.",
      tags: [],
      category: 'landmark',
      created_at: entry.created_at,
      _pending: true,
      _objectUrl: URL.createObjectURL(entry.file),
    };
  }

  const handlePhotos = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    setErrorMsg('');
    setUploading(true);

    const dayContext = `Day ${day.n} (${day.weekday} ${day.date}) — ${day.title} · ${day.route}`;
    let failures = 0;

    for (const file of files) {
      const ext = file.name.split('.').pop();
      const id = newId(); // client id -> idempotent sync + deterministic path
      const path = `${day.n}/${id}.${ext}`;
      const base = {
        id,
        day_number: day.n,
        author_email: userEmail,
        storage_path: path,
        title: 'Identifying...',
        location: 'Analyzing photo',
        description: '',
        tags: [],
        category: 'landmark',
        created_at: new Date().toISOString(),
      };

      // Offline — queue the file and show it from a local object URL
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        try {
          await queuePhoto({ id, day_number: day.n, author_email: userEmail, day_context: dayContext, file, ext, created_at: base.created_at });
          const objectUrl = URL.createObjectURL(file);
          setPhotos(prev => [{
            ...base,
            title: 'Saved offline',
            location: '',
            description: "Will upload when you're back online.",
            _pending: true,
            _objectUrl: objectUrl,
          }, ...prev]);
        } catch (e) {
          console.error('Queue photo failed:', e);
          failures++;
        }
        continue;
      }

      // Online — upload, create the row, then identify
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, file, { upsert: true });
      if (uploadError) {
        console.error('Upload error:', uploadError);
        failures++;
        continue;
      }

      const { error: insertError } = await supabase
        .from('trip_photos')
        .upsert(base, { onConflict: 'id', ignoreDuplicates: true });
      if (insertError) {
        console.error('Insert error:', insertError);
        failures++;
        continue;
      }

      // Add to local state immediately (optimistic UI)
      setPhotos(prev => (prev.some(p => p.id === id) ? prev : [{ ...base, _loading: true }, ...prev]));

      // Call identify API
      try {
        const result = await identifyPhoto(id, path, dayContext);
        setPhotos(prev => prev.map(p =>
          p.id === id ? { ...p, ...result, _loading: false } : p
        ));
      } catch (err) {
        console.error('Identify error:', err);
        failures++;
        setPhotos(prev => prev.map(p =>
          p.id === id
            ? {
                ...p,
                title: file.name.split('.')[0] || 'Photo',
                location: '—',
                description: 'Identification failed — tap to retry.',
                _loading: false,
                _failed: true,
              }
            : p
        ));
      }
    }

    if (failures > 0) {
      setErrorMsg(`${failures} photo${failures > 1 ? 's' : ''} couldn't be fully processed. They're saved — you can try again later.`);
    }
    setUploading(false);
  }, [day, userEmail]);

  async function retryIdentify(photo) {
    const dayContext = `Day ${day.n} (${day.weekday} ${day.date}) — ${day.title} · ${day.route}`;

    setPhotos(prev => prev.map(p =>
      p.id === photo.id ? { ...p, _loading: true, _failed: false } : p
    ));

    try {
      const result = await identifyPhoto(photo.id, photo.storage_path, dayContext);
      setPhotos(prev => prev.map(p =>
        p.id === photo.id ? { ...p, ...result, _loading: false } : p
      ));
    } catch (err) {
      console.error('Retry identify error:', err);
      setPhotos(prev => prev.map(p =>
        p.id === photo.id
          ? { ...p, _loading: false, _failed: true, description: 'Identification failed — tap to retry.' }
          : p
      ));
    }
  }

  async function deletePhoto(photo) {
    // Pending (not yet uploaded): drop from the offline queue + release the blob URL
    if (photo._pending) {
      await unqueuePhoto(photo.id).catch(() => {});
      if (photo._objectUrl) URL.revokeObjectURL(photo._objectUrl);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      // Best-effort in case it synced moments ago
      supabase.storage.from('photos').remove([photo.storage_path]).catch(() => {});
      supabase.from('trip_photos').delete().eq('id', photo.id).then(undefined, () => {});
      return;
    }

    // Delete from storage
    await supabase.storage.from('photos').remove([photo.storage_path]);

    // Delete from database
    const { error } = await supabase
      .from('trip_photos')
      .delete()
      .eq('id', photo.id);

    if (!error) {
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
    } else {
      console.error('Delete photo error:', error);
      setErrorMsg("Couldn't delete that photo. Please try again.");
    }
  }

  function startEdit(photo) {
    setEditingId(photo.id);
    setDraft({
      title: photo.title || '',
      location: photo.location || '',
      description: photo.description || '',
      category: photo.category || 'landmark',
      tags: (photo.tags || []).join(', '),
      people: (photo.people || []).join(', '),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  // Split a comma-separated input into a clean array
  function splitList(s) {
    return (s || '').split(',').map(x => x.trim()).filter(Boolean);
  }

  async function saveEdit(photo) {
    if (!draft) return;
    setSavingEdit(true);
    const updates = {
      title: draft.title.trim() || 'Untitled',
      location: draft.location.trim(),
      description: draft.description.trim(),
      category: draft.category,
      tags: splitList(draft.tags),
      people: splitList(draft.people),
      verified: true, // human-confirmed; feeds future identifications
    };
    const { error } = await supabase
      .from('trip_photos')
      .update(updates)
      .eq('id', photo.id);

    if (!error) {
      setPhotos(prev => prev.map(p => (p.id === photo.id ? { ...p, ...updates } : p)));
      cancelEdit();
    } else {
      console.error('Save edit error:', error);
      setErrorMsg("Couldn't save your changes. Please try again.");
    }
    setSavingEdit(false);
  }

  const editInputStyle = {
    width: '100%', boxSizing: 'border-box', marginBottom: '0.4rem',
    background: THEME.rgba(THEME.base.white, 0.05),
    border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
    borderRadius: '6px', padding: '0.4rem 0.6rem',
    color: THEME.parchment, fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none',
  };

  return (
    <div>
      <div style={{
        border: `2px dashed ${THEME.rgba(THEME.base.goldDeep, 0.3)}`,
        borderRadius: '12px', padding: '2rem', textAlign: 'center',
        background: THEME.rgba(THEME.base.goldDeep, 0.03), marginBottom: '1.5rem',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
        <div style={{ color: THEME.gold, fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.3rem' }}>
          {uploading ? '🔍 Processing photos...' : 'Add Photos'}
        </div>
        <div style={{ color: THEME.blueMuted, fontSize: '0.75rem', marginBottom: '1rem' }}>
          Claude will identify landmarks, food, and places
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={uploading}
          onChange={e => {
            const files = [...e.target.files];
            if (files.length > 0) handlePhotos(files);
            e.target.value = '';
          }}
          style={{
            display: 'block', margin: '0 auto',
            color: THEME.gold, fontFamily: 'inherit', fontSize: '0.85rem',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.5 : 1,
          }}
        />
      </div>

      {errorMsg && (
        <div style={{
          background: THEME.rgba(THEME.base.red, 0.12),
          border: `1px solid ${THEME.rgba(THEME.base.red, 0.3)}`,
          borderRadius: '10px', padding: '0.8rem 1rem',
          color: THEME.error, fontSize: '0.8rem',
          marginBottom: '1rem', lineHeight: 1.5,
        }}>⚠️ {errorMsg}</div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: THEME.blueMuted, fontSize: '0.9rem' }}>
          Loading photos...
        </div>
      ) : photos.length > 0 ? (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {photos.map(photo => (
            <div key={photo.id} style={{
              background: THEME.rgba(THEME.base.white, 0.04),
              border: `1px solid ${THEME.rgba(THEME.base.gold, 0.1)}`,
              borderRadius: '12px', overflow: 'hidden',
              cursor: photo._failed ? 'pointer' : 'default',
            }}
            onClick={() => photo._failed && retryIdentify(photo)}
            >
              <img
                src={photo._objectUrl || getPhotoUrl(photo.storage_path)}
                alt={photo.title}
                style={{
                  width: '100%', height: '180px', objectFit: 'cover', display: 'block',
                }}
              />
              <div style={{ padding: '1rem' }} onClick={editingId === photo.id ? (e) => e.stopPropagation() : undefined}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.3rem'
                }}>
                  <div style={{ fontSize: '0.65rem', color: THEME.blueMuted }}>
                    {truncateEmail(photo.author_email)}
                  </div>
                  {!photo._loading && editingId !== photo.id && (
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      {!photo._pending && (
                        <button
                          onClick={(e) => { e.stopPropagation(); startEdit(photo); }}
                          title="Edit / correct"
                          style={{
                            background: 'none', border: 'none', color: THEME.blueMuted,
                            cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem 0.3rem',
                          }}
                        >
                          ✎
                        </button>
                      )}
                      {photo.author_email === userEmail && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deletePhoto(photo); }}
                          style={{
                            background: 'none', border: 'none', color: THEME.blueMuted,
                            cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem 0.3rem',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {editingId === photo.id ? (
                  <div>
                    <input style={editInputStyle} value={draft.title}
                      onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Title" />
                    <input style={editInputStyle} value={draft.location}
                      onChange={e => setDraft({ ...draft, location: e.target.value })} placeholder="Location" />
                    <textarea style={{ ...editInputStyle, resize: 'vertical', lineHeight: 1.4 }} rows={3} value={draft.description}
                      onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Description" />
                    <select style={editInputStyle} value={draft.category}
                      onChange={e => setDraft({ ...draft, category: e.target.value })}>
                      {Object.keys(CATEGORY_ICONS).map(c => (
                        <option key={c} value={c}>{(CATEGORY_ICONS[c] || '')} {c}</option>
                      ))}
                    </select>
                    <input style={editInputStyle} value={draft.people}
                      onChange={e => setDraft({ ...draft, people: e.target.value })} placeholder="People (comma-separated)" />
                    <input style={editInputStyle} value={draft.tags}
                      onChange={e => setDraft({ ...draft, tags: e.target.value })} placeholder="Tags (comma-separated)" />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                      <button onClick={() => saveEdit(photo)} disabled={savingEdit} style={{
                        padding: '0.4rem 1rem', border: 'none', borderRadius: '6px',
                        background: savingEdit ? THEME.rgba(THEME.base.gold, 0.3) : `linear-gradient(135deg, ${THEME.gold}, ${THEME.goldLight})`,
                        color: THEME.bgDeep, fontWeight: 700, fontFamily: 'inherit', fontSize: '0.75rem',
                        cursor: savingEdit ? 'not-allowed' : 'pointer',
                      }}>{savingEdit ? 'Saving...' : 'Save'}</button>
                      <button onClick={cancelEdit} disabled={savingEdit} style={{
                        padding: '0.4rem 1rem', borderRadius: '6px',
                        background: 'none', border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
                        color: THEME.blue, fontFamily: 'inherit', fontSize: '0.75rem', cursor: 'pointer',
                      }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <div style={{ fontSize: '0.95rem', color: THEME.cream, fontWeight: 600 }}>
                        {photo._loading ? <span style={{ opacity: 0.6 }}>✨ Identifying...</span> : photo.title}
                      </div>
                      <div style={{ fontSize: '1.2rem' }}>{(photo._loading || photo._pending) ? '⏳' : (CATEGORY_ICONS[photo.category] || '📸')}</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: THEME.gold, marginBottom: '0.5rem' }}>
                      📍 {photo.location}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: THEME.blue, lineHeight: 1.5 }}>
                      {photo.description}
                    </div>
                    {photo.people?.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: THEME.sand, marginTop: '0.5rem' }}>
                        👤 {photo.people.join(', ')}
                      </div>
                    )}
                    {photo.tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.7rem' }}>
                        {photo.tags.map(tag => (
                          <span key={tag} style={{
                            padding: '0.2rem 0.5rem',
                            background: THEME.rgba(THEME.base.goldDeep, 0.1),
                            border: `1px solid ${THEME.rgba(THEME.base.goldDeep, 0.2)}`,
                            borderRadius: '20px', fontSize: '0.65rem',
                            color: THEME.goldMuted, letterSpacing: '0.05em',
                          }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: THEME.blueDim, fontSize: '0.9rem' }}>
          No photos for {day.date} yet.<br />
          <span style={{ fontSize: '0.8rem' }}>Upload above to auto-identify.</span>
        </div>
      )}
    </div>
  );
}
