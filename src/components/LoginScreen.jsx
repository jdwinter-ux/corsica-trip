import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { THEME } from '../config/theme';

const TRIP_PASSCODE = import.meta.env.VITE_TRIP_PASSCODE;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Fail closed: if no passcode is configured, never let a (blank) one through
    if (!TRIP_PASSCODE) {
      setError('Login is not configured yet. Please contact the trip organizer.');
      return;
    }

    if (passcode !== TRIP_PASSCODE) {
      setError('Invalid trip passcode');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setLoading(false);

    if (authError) {
      // Provide friendlier messages for common errors
      if (authError.message.toLowerCase().includes('rate limit')) {
        setError('Too many login attempts. Please wait a minute before trying again.');
      } else {
        setError(authError.message);
      }
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div style={{
        minHeight: '100vh',
        background: `linear-gradient(160deg, ${THEME.bgDeep} 0%, ${THEME.bgMid} 40%, ${THEME.bgDeep} 100%)`,
        fontFamily: "'Georgia', 'Times New Roman', serif",
        color: THEME.parchment,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}>
        <div style={{
          background: THEME.rgba(THEME.base.white, 0.03),
          border: `1px solid ${THEME.rgba(THEME.base.gold, 0.15)}`,
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
          <h2 style={{ color: THEME.cream, margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 400 }}>
            Check Your Email
          </h2>
          <p style={{ color: THEME.blue, fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
            We sent a login link to<br />
            <span style={{ color: THEME.gold }}>{email}</span>
          </p>
          <p style={{ color: THEME.blueMuted, fontSize: '0.8rem', marginTop: '1.5rem' }}>
            Click the link in your email to join the voyage journal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(160deg, ${THEME.bgDeep} 0%, ${THEME.bgMid} 40%, ${THEME.bgDeep} 100%)`,
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: THEME.parchment,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
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

      <div style={{
        background: THEME.rgba(THEME.base.white, 0.03),
        border: `1px solid ${THEME.rgba(THEME.base.gold, 0.15)}`,
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        maxWidth: '400px',
        width: '100%',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: THEME.gold, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            ⚓ Voyage Journal
          </div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 400, color: THEME.cream, letterSpacing: '0.02em' }}>
            Corsica &amp; Nice
          </h1>
          <div style={{ fontSize: '0.85rem', color: THEME.blue, marginTop: '0.3rem' }}>
            Sep 5–12, 2026
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: THEME.blue, marginBottom: '0.4rem', letterSpacing: '0.08em' }}>
              TRIP PASSCODE
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter shared passcode"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: THEME.rgba(THEME.base.white, 0.05),
                border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
                borderRadius: '8px',
                padding: '0.8rem 1rem',
                color: THEME.parchment,
                fontFamily: 'inherit',
                fontSize: '1rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: THEME.blue, marginBottom: '0.4rem', letterSpacing: '0.08em' }}>
              YOUR EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: THEME.rgba(THEME.base.white, 0.05),
                border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
                borderRadius: '8px',
                padding: '0.8rem 1rem',
                color: THEME.parchment,
                fontFamily: 'inherit',
                fontSize: '1rem',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: THEME.rgba(THEME.base.red, 0.12),
              border: `1px solid ${THEME.rgba(THEME.base.red, 0.3)}`,
              borderRadius: '8px',
              padding: '0.7rem 1rem',
              color: THEME.error,
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.9rem',
              background: loading ? THEME.rgba(THEME.base.goldDeep, 0.3) : `linear-gradient(135deg, ${THEME.gold}, ${THEME.goldLight})`,
              border: 'none',
              borderRadius: '8px',
              color: THEME.bgDeep,
              fontWeight: 700,
              fontFamily: 'inherit',
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            {loading ? 'Sending...' : 'Send Login Link'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: THEME.blueMuted, fontSize: '0.75rem', marginTop: '1.5rem', lineHeight: 1.5 }}>
          Enter the trip passcode shared by your host<br />to receive a magic login link.
        </p>
      </div>
    </div>
  );
}
