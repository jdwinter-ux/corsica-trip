import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { THEME } from '../config/theme';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const refUrl = (path) => `${supabaseUrl}/storage/v1/object/public/photos/${path}`;

// Manage trip travelers and their reference headshots. Reference photos are
// uploaded into the `photos` bucket under a travelers/ prefix and their paths
// stored on trip_travelers.reference_paths — api/identify.js feeds them to the
// AI as labeled faces to improve people recognition.
export default function TravelersModal({ onClose }) {
  const [travelers, setTravelers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { fetchTravelers(); }, []);

  async function fetchTravelers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('trip_travelers')
      .select('*')
      .order('role', { ascending: true });
    if (!error && data) setTravelers(data);
    setLoading(false);
  }

  async function addTraveler() {
    if (!newName.trim()) return;
    setAdding(true);
    const { data, error } = await supabase
      .from('trip_travelers')
      .insert({ name: newName.trim(), role: newRole.trim() || null, description: newDesc.trim() || null })
      .select()
      .single();
    if (!error && data) {
      setTravelers(prev => [...prev, data]);
      setNewName(''); setNewRole(''); setNewDesc('');
    }
    setAdding(false);
  }

  async function saveDescription(traveler, description) {
    if (description === (traveler.description || '')) return;
    await supabase.from('trip_travelers')
      .update({ description: description || null, updated_at: new Date().toISOString() })
      .eq('id', traveler.id);
    setTravelers(prev => prev.map(t => (t.id === traveler.id ? { ...t, description } : t)));
  }

  async function uploadHeadshot(traveler, file) {
    if (!file) return;
    setBusyId(traveler.id);
    const ext = file.name.split('.').pop();
    const path = `travelers/${traveler.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('photos').upload(path, file);
    if (upErr) {
      console.error('Headshot upload failed:', upErr);
      alert('Could not upload that photo. Please try again.');
      setBusyId(null);
      return;
    }
    const next = [...(traveler.reference_paths || []), path];
    const { error } = await supabase.from('trip_travelers')
      .update({ reference_paths: next, updated_at: new Date().toISOString() })
      .eq('id', traveler.id);
    if (!error) {
      setTravelers(prev => prev.map(t => (t.id === traveler.id ? { ...t, reference_paths: next } : t)));
    } else {
      console.error('Headshot save failed:', error);
      // Roll back the orphaned upload so it doesn't linger in storage
      await supabase.storage.from('photos').remove([path]);
      alert('Could not save that photo. Please try again.');
    }
    setBusyId(null);
  }

  async function removeHeadshot(traveler, path) {
    setBusyId(traveler.id);
    await supabase.storage.from('photos').remove([path]);
    const next = (traveler.reference_paths || []).filter(p => p !== path);
    const { error } = await supabase.from('trip_travelers')
      .update({ reference_paths: next, updated_at: new Date().toISOString() })
      .eq('id', traveler.id);
    if (!error) setTravelers(prev => prev.map(t => (t.id === traveler.id ? { ...t, reference_paths: next } : t)));
    setBusyId(null);
  }

  const inputStyle = {
    boxSizing: 'border-box',
    background: THEME.rgba(THEME.base.white, 0.05),
    border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
    borderRadius: '6px', padding: '0.4rem 0.6rem',
    color: THEME.parchment, fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: THEME.rgba(THEME.base.black, 0.4),
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: `linear-gradient(160deg, ${THEME.bgMid}, ${THEME.bgDeep})`,
          border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
          borderRadius: '14px', padding: '1.5rem',
          fontFamily: "'Georgia', 'Times New Roman', serif", color: THEME.parchment,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 400, color: THEME.cream }}>👥 Travelers</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: THEME.blue, cursor: 'pointer', fontSize: '1.1rem',
          }}>✕</button>
        </div>
        <div style={{ fontSize: '0.75rem', color: THEME.blueMuted, marginBottom: '1.2rem', lineHeight: 1.5 }}>
          Add a reference headshot for each person so Léa can recognize faces in photos.
          More detail (and a clear photo) means better identification.
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: THEME.blueMuted }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {travelers.map(t => (
              <div key={t.id} style={{
                background: THEME.rgba(THEME.base.white, 0.03),
                border: `1px solid ${THEME.rgba(THEME.base.gold, 0.1)}`,
                borderRadius: '10px', padding: '0.9rem 1rem',
              }}>
                <div style={{ fontSize: '0.95rem', color: THEME.cream, fontWeight: 600 }}>
                  {t.name}{t.role ? <span style={{ fontSize: '0.7rem', color: THEME.gold, marginLeft: '0.5rem' }}>{t.role}</span> : null}
                </div>
                <textarea
                  defaultValue={t.description || ''}
                  onBlur={e => saveDescription(t, e.target.value.trim())}
                  placeholder="Description (hair, build, glasses, usual clothing…)"
                  rows={2}
                  style={{ ...inputStyle, width: '100%', marginTop: '0.5rem', resize: 'vertical', lineHeight: 1.4 }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.6rem' }}>
                  {(t.reference_paths || []).map(path => (
                    <div key={path} style={{ position: 'relative' }}>
                      <img src={refUrl(path)} alt={t.name} style={{
                        width: 56, height: 56, objectFit: 'cover', borderRadius: '8px',
                        border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
                      }} />
                      <button onClick={() => removeHeadshot(t, path)} title="Remove" style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 18, height: 18, borderRadius: '50%', border: 'none',
                        background: THEME.errorStrong, color: THEME.bgDeep, fontSize: '0.6rem',
                        cursor: 'pointer', lineHeight: 1,
                      }}>✕</button>
                    </div>
                  ))}
                  <label style={{
                    width: 56, height: 56, borderRadius: '8px', cursor: busyId === t.id ? 'wait' : 'pointer',
                    border: `1px dashed ${THEME.rgba(THEME.base.gold, 0.3)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: THEME.gold, fontSize: '1.2rem',
                  }}>
                    {busyId === t.id ? '…' : '＋'}
                    <input type="file" accept="image/*" disabled={busyId === t.id}
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; uploadHeadshot(t, f); }}
                      style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add a new traveler */}
        <div style={{ marginTop: '1.2rem', paddingTop: '1rem', borderTop: `1px solid ${THEME.rgba(THEME.base.gold, 0.12)}` }}>
          <div style={{ fontSize: '0.75rem', color: THEME.gold, letterSpacing: '0.05em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            Add a traveler
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <input style={{ ...inputStyle, flex: 2 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" />
            <input style={{ ...inputStyle, flex: 1 }} value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Role" />
          </div>
          <input style={{ ...inputStyle, width: '100%', marginBottom: '0.5rem' }} value={newDesc}
            onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" />
          <button onClick={addTraveler} disabled={adding || !newName.trim()} style={{
            padding: '0.5rem 1.2rem', border: 'none', borderRadius: '8px',
            background: adding || !newName.trim() ? THEME.rgba(THEME.base.gold, 0.3) : `linear-gradient(135deg, ${THEME.gold}, ${THEME.goldLight})`,
            color: THEME.bgDeep, fontWeight: 700, fontFamily: 'inherit', fontSize: '0.8rem',
            cursor: adding || !newName.trim() ? 'not-allowed' : 'pointer',
          }}>{adding ? 'Adding...' : 'Add'}</button>
        </div>
      </div>
    </div>
  );
}
