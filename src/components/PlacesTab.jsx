import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtime } from '../lib/useRealtime';
import { useOnReconnect } from '../lib/useOnReconnect';
import { queueNote, getQueuedNotesForDay, unqueueNote, newId } from '../lib/notesQueue';
import { DAY_DETAILS } from '../data/dayDetails';
import { THEME } from '../config/theme';

function truncateEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 6)}...@${domain}`;
}

export default function PlacesTab({ day, userEmail }) {
  const dayNumber = day?.n;
  const details = DAY_DETAILS[dayNumber];

  const [notes, setNotes] = useState([]);
  const [noteInput, setNoteInput] = useState('');
  const [notesLoading, setNotesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notesError, setNotesError] = useState('');

  useEffect(() => {
    if (!dayNumber) return;
    const req = { active: true };
    fetchNotes(req);
    // Ignore an in-flight fetch's result if the day changes before it resolves
    return () => { req.active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNumber]);

  // Live updates: notes added/removed by other travelers on this day
  useRealtime(
    `notes-day-${dayNumber}`,
    dayNumber ? { table: 'trip_notes', filter: `day_number=eq.${dayNumber}` } : {},
    {
      onInsert: (row) =>
        setNotes(prev => {
          const idx = prev.findIndex(n => n.id === row.id);
          // Replace an optimistic/pending copy with the server row (clears the badge)
          if (idx !== -1) return prev.map((n, i) => (i === idx ? row : n));
          return [...prev, row];
        }),
      onDelete: (oldRow) =>
        setNotes(prev => prev.filter(n => n.id !== oldRow.id)),
    }
  );

  // Refetch this day's notes after a reconnect to catch anything missed offline
  useOnReconnect(() => {
    if (dayNumber) fetchNotes();
  });

  async function fetchNotes(req = { active: true }) {
    setNotesLoading(true);
    const { data, error } = await supabase
      .from('trip_notes')
      .select('*')
      .eq('day_number', dayNumber)
      .order('created_at', { ascending: true });

    if (!req.active) return; // a newer day was selected; drop this stale result

    // Notes saved offline (not yet on the server) are shown with a pending badge
    const queued = await getQueuedNotesForDay(dayNumber);
    if (!req.active) return;

    if (!error && data) {
      setNotes(prev => {
        const have = new Set(data.map(n => n.id));
        // Preserve still-unsynced notes for THIS day (optimistic online saves +
        // queued offline notes) so a concurrent refetch can't drop them.
        const localPending = prev.filter(
          n => n._pending && n.day_number === dayNumber && !have.has(n.id)
        );
        const seen = new Set([...have, ...localPending.map(n => n.id)]);
        const queuedPending = queued
          .filter(q => !seen.has(q.id))
          .map(q => ({ ...q, _pending: true }));
        return [...data, ...localPending, ...queuedPending];
      });
      setNotesError('');
    } else if (error) {
      console.error('Fetch notes error:', error);
      // Offline/failed: at least show what we have queued locally
      setNotes(queued.map(q => ({ ...q, _pending: true })));
      setNotesError("Couldn't load notes. They'll appear when you're back online.");
    }
    setNotesLoading(false);
  }

  async function saveNote() {
    if (!noteInput.trim()) return;
    setSaving(true);
    setNotesError('');

    // Client-generated id -> idempotent sync + clean realtime de-dup
    const note = {
      id: newId(),
      day_number: dayNumber,
      author_email: userEmail,
      body: noteInput.trim(),
      created_at: new Date().toISOString(),
    };

    // Show it immediately, marked pending until it reaches the server
    setNotes(prev => [...prev, { ...note, _pending: true }]);
    setNoteInput('');

    const { error } = await supabase
      .from('trip_notes')
      .upsert(note, { onConflict: 'id', ignoreDuplicates: true });

    if (!error) {
      setNotes(prev => prev.map(n => (n.id === note.id ? { ...n, _pending: false } : n)));
    } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // Offline — queue it; the badge stays until it syncs on reconnect
      try {
        await queueNote(note);
      } catch (e) {
        console.error('Queue note failed:', e);
        setNotes(prev => prev.filter(n => n.id !== note.id));
        setNotesError("Couldn't save your note offline on this device.");
      }
    } else {
      // Online but a real error (e.g. RLS) — revert and surface
      console.error('Save note error:', error);
      setNotes(prev => prev.filter(n => n.id !== note.id));
      setNotesError("Couldn't save your note. Please try again.");
    }
    setSaving(false);
  }

  async function deleteNote(note) {
    // Remove from the offline queue first (awaited) so a concurrent flush on
    // reconnect can't re-sync a note we're deleting.
    await unqueueNote(note.id).catch(() => {});
    const { error } = await supabase
      .from('trip_notes')
      .delete()
      .eq('id', note.id);

    // Remove locally when the server delete worked, or it was only pending,
    // or we're offline (queue entry already removed above).
    if (!error || note._pending || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setNotes(prev => prev.filter(n => n.id !== note.id));
    } else {
      console.error('Delete note error:', error);
      setNotesError("Couldn't delete that note. Please try again.");
    }
  }

  return (
    <div>
      {details ? (
        <>
          {/* Hero section */}
          <div style={{
            background: THEME.rgba(THEME.base.goldDeep, 0.08),
            borderLeft: `3px solid ${THEME.gold}`,
            borderRadius: '0 12px 12px 0',
            padding: '1.2rem 1.5rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: THEME.sand,
              lineHeight: 1.7,
              fontStyle: 'italic',
            }}>
              {details.hero}
            </div>
          </div>

          {/* Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {details.sections.map((section, index) => (
              <div
                key={index}
                style={{
                  background: THEME.rgba(THEME.base.white, 0.03),
                  border: `1px solid ${THEME.rgba(THEME.base.gold, 0.1)}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                {/* Section header */}
                <div style={{
                  padding: '0.8rem 1rem',
                  background: THEME.rgba(THEME.base.white, 0.02),
                  borderBottom: `1px solid ${THEME.rgba(THEME.base.gold, 0.08)}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                }}>
                  <span style={{ fontSize: '1.1rem' }}>{section.icon}</span>
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: THEME.cream,
                    letterSpacing: '0.02em',
                  }}>
                    {section.title}
                  </span>
                </div>

                {/* Section content */}
                <div style={{
                  padding: '1rem 1.2rem',
                  fontSize: '0.85rem',
                  color: THEME.blueSky,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}>
                  {section.content}
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          {details.tips && details.tips.length > 0 && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem 1.2rem',
              background: THEME.rgba(THEME.base.blueGray, 0.08),
              border: `1px solid ${THEME.rgba(THEME.base.blueGray, 0.15)}`,
              borderRadius: '12px',
            }}>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: THEME.blue,
                marginBottom: '0.6rem',
                letterSpacing: '0.05em',
              }}>
                💡 TIPS FOR TODAY
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: '1.2rem',
                fontSize: '0.8rem',
                color: THEME.blueSoft,
                lineHeight: 1.8,
              }}>
                {details.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: THEME.blueMuted }}>
          No information available for this day.
        </div>
      )}

      {/* Shared notes */}
      <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: `1px solid ${THEME.rgba(THEME.base.gold, 0.12)}` }}>
        <div style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: THEME.gold,
          marginBottom: '1rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          📓 Traveler Notes
        </div>

        <div style={{ marginBottom: '1.2rem' }}>
          <textarea
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            placeholder="Add a note for this day..."
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: THEME.rgba(THEME.base.white, 0.05),
              border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
              borderRadius: '10px', padding: '0.9rem 1rem',
              color: THEME.parchment, fontFamily: 'inherit', fontSize: '0.9rem',
              resize: 'none', outline: 'none', lineHeight: 1.6,
            }}
          />
          <button
            onClick={saveNote}
            disabled={saving || !noteInput.trim()}
            style={{
              marginTop: '0.6rem', padding: '0.6rem 1.5rem',
              background: saving ? THEME.rgba(THEME.base.goldDeep, 0.3) : `linear-gradient(135deg, ${THEME.gold}, ${THEME.goldLight})`,
              border: 'none', borderRadius: '8px',
              color: THEME.bgDeep, fontWeight: 700, fontFamily: 'inherit',
              fontSize: '0.85rem', cursor: saving ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
              opacity: !noteInput.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Note'}
          </button>
        </div>

        {notesError && (
          <div style={{
            background: THEME.rgba(THEME.base.red, 0.12),
            border: `1px solid ${THEME.rgba(THEME.base.red, 0.3)}`,
            borderRadius: '8px', padding: '0.6rem 0.9rem',
            color: THEME.error, fontSize: '0.78rem',
            marginBottom: '1rem', lineHeight: 1.5,
          }}>⚠️ {notesError}</div>
        )}

        {notesLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: THEME.blueMuted, fontSize: '0.9rem' }}>
            Loading notes...
          </div>
        ) : notes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {notes.map(note => (
              <div key={note.id} style={{
                background: THEME.rgba(THEME.base.white, 0.03),
                border: `1px solid ${THEME.rgba(THEME.base.gold, 0.1)}`,
                borderRadius: '10px', padding: '1rem 1.2rem',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}>
                  <div style={{ fontSize: '0.7rem', color: THEME.gold, letterSpacing: '0.05em' }}>
                    {truncateEmail(note.author_email)}
                  </div>
                  {note.author_email === userEmail && (
                    <button
                      onClick={() => deleteNote(note)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: THEME.blueMuted,
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.4rem',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div style={{
                  whiteSpace: 'pre-wrap', lineHeight: 1.8,
                  fontSize: '0.9rem', color: THEME.sand,
                }}>
                  {note.body}
                </div>
                <div style={{
                  fontSize: '0.65rem',
                  color: THEME.blueDim,
                  marginTop: '0.6rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <span>{new Date(note.created_at).toLocaleString()}</span>
                  {note._pending && (
                    <span style={{ color: THEME.goldMuted }}>⏳ Saving — syncs when online</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: THEME.blueDim, fontSize: '0.9rem' }}>
            No notes yet for {day?.date}.<br />
            <span style={{ fontSize: '0.8rem' }}>Start writing above.</span>
          </div>
        )}
      </div>
    </div>
  );
}
