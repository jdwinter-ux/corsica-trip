import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useRealtime } from './lib/useRealtime';
import { useOnReconnect } from './lib/useOnReconnect';
import { flushNotes } from './lib/notesQueue';
import { flushPhotos } from './lib/photoQueue';
import { TRIP } from './data/trip';
import LoginScreen from './components/LoginScreen';
import DaySelector from './components/DaySelector';
import DayCard from './components/DayCard';
import PlanTab from './components/PlanTab';
import PlacesTab from './components/PlacesTab';
import PhotosTab from './components/PhotosTab';
import ChatTab from './components/ChatTab';
import MapTab from './components/MapTab';
import TravelersModal from './components/TravelersModal';
import { THEME } from './config/theme';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(0);
  const [tab, setTab] = useState('plan');
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [showTravelers, setShowTravelers] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const day = TRIP.days[activeDay];
  const userEmail = session?.user?.email;

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Track connectivity to show an offline banner
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (session) {
      fetchTotalPhotos();
      flushNotes();  // sync notes saved offline in a previous session
      flushPhotos(); // and photos
    }
  }, [session]);

  // Ask the browser to keep our offline queue from being evicted
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  // Keep the header photo count live as photos are added/removed anywhere
  useRealtime(
    'header-photo-count',
    session ? { table: 'trip_photos' } : {},
    {
      onInsert: () => fetchTotalPhotos(),
      onDelete: () => fetchTotalPhotos(),
    }
  );

  // Recover the count + flush queued offline notes/photos after a reconnect
  useOnReconnect(() => {
    if (session) {
      fetchTotalPhotos();
      flushNotes();
      flushPhotos();
    }
  });

  async function fetchTotalPhotos() {
    try {
      const { count } = await supabase
        .from('trip_photos')
        .select('*', { count: 'exact', head: true });
      setTotalPhotos(count || 0);
    } catch (err) {
      // Offline or transient — keep the last known count
      console.debug('Photo count unavailable:', err?.message);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    // Clear cached trip data so it isn't served to the next user on a shared device
    if (typeof caches !== 'undefined') {
      await Promise.all([
        caches.delete('supabase-rest'),
        caches.delete('supabase-images'),
      ]).catch(() => { /* best-effort */ });
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: `linear-gradient(160deg, ${THEME.bgDeep} 0%, ${THEME.bgMid} 40%, ${THEME.bgDeep} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: THEME.blue,
        fontFamily: "'Georgia', 'Times New Roman', serif",
      }}>
        Loading...
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(160deg, ${THEME.bgDeep} 0%, ${THEME.bgMid} 40%, ${THEME.bgDeep} 100%)`,
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: THEME.parchment,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Offline banner */}
      {!online && (
        <div style={{
          position: 'relative', zIndex: 2,
          background: THEME.rgba(THEME.base.amber, 0.15),
          borderBottom: `1px solid ${THEME.rgba(THEME.base.gold, 0.3)}`,
          color: THEME.cream, textAlign: 'center',
          padding: '0.5rem 1rem', fontSize: '0.75rem', letterSpacing: '0.03em',
        }}>
          ⚡ Offline — showing saved data. New notes, photos, and chat will work again once you're back online.
        </div>
      )}

      {/* Decorative backgrounds */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '180px',
        background: `linear-gradient(180deg, transparent, ${THEME.rgba(THEME.base.blueDeep, 0.15)})`,
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', top: 0, right: '-100px', width: '500px', height: '500px',
        background: `radial-gradient(circle, ${THEME.rgba(THEME.base.amber, 0.06)} 0%, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Header */}
      <header style={{
        padding: '2rem 1.5rem 1rem',
        borderBottom: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: THEME.gold, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                ⚓ Voyage Journal
              </div>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 400, color: THEME.cream, letterSpacing: '0.02em' }}>
                {TRIP.title}
              </h1>
              <div style={{ fontSize: '0.85rem', color: THEME.blue, marginTop: '0.3rem', letterSpacing: '0.1em' }}>
                {TRIP.subtitle} &nbsp;·&nbsp; {TRIP.dates}
              </div>
              {totalPhotos > 0 && (
                <div style={{ fontSize: '0.75rem', color: THEME.blueMuted, marginTop: '0.4rem' }}>
                  {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''} logged
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', color: THEME.blueMuted, marginBottom: '0.3rem' }}>
                {userEmail}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowTravelers(true)}
                  style={{
                    background: 'none',
                    border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
                    borderRadius: '6px',
                    padding: '0.3rem 0.7rem',
                    color: THEME.blue,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  👥 Travelers
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'none',
                    border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
                    borderRadius: '6px',
                    padding: '0.3rem 0.7rem',
                    color: THEME.blue,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '1.2rem 1rem 4rem', position: 'relative', zIndex: 1 }}>
        {/* Day selector */}
        <DaySelector activeDay={activeDay} setActiveDay={setActiveDay} />

        {/* Active day card */}
        <DayCard day={day} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '1.2rem', background: THEME.rgba(THEME.base.white, 0.04), borderRadius: '10px', padding: '4px' }}>
          {[['plan', '🗺️ Plan'], ['map', '🧭 Map'], ['places', '📍 Places'], ['photos', '📷 Photos'], ['chat', '💬 Chat']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: '0.6rem', border: 'none', borderRadius: '8px',
              background: tab === key ? THEME.rgba(THEME.base.goldDeep, 0.2) : 'transparent',
              color: tab === key ? THEME.gold : THEME.blue,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem',
              letterSpacing: '0.05em', transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'plan' && <PlanTab day={day} />}
        {tab === 'map' && <MapTab day={day} />}
        {tab === 'places' && <PlacesTab day={day} userEmail={userEmail} />}
        {tab === 'photos' && <PhotosTab day={day} userEmail={userEmail} />}
        {tab === 'chat' && <ChatTab userEmail={userEmail} />}
      </main>

      {showTravelers && <TravelersModal onClose={() => setShowTravelers(false)} />}
    </div>
  );
}
