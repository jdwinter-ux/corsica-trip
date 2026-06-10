import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { THEME } from '../config/theme';

// Shared input styling
const inputStyle = {
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
};

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  color: THEME.blue,
  marginBottom: '0.4rem',
  letterSpacing: '0.08em',
};

export default function LoginScreen() {
  const [step, setStep] = useState('request'); // 'request' | 'verify'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Step 1: validate the email, then email a login code.
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    // Normalize: mobile keyboards capitalize and add trailing spaces.
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email');
      return;
    }
    setEmail(normalizedEmail); // keep verify/resend consistent with what we sent

    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    });

    setLoading(false);

    if (authError) {
      if (authError.message.toLowerCase().includes('rate limit')) {
        setError('Too many login attempts. Please wait a minute before trying again.');
      } else {
        setError(authError.message);
      }
    } else {
      setStep('verify');
    }
  };

  // Step 2: verify the login code. On success, App's auth listener takes over.
  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    // Supabase email OTP length is configurable (6–10 digits); don't assume 6.
    const token = code.replace(/\D/g, '');
    if (!/^\d{6,10}$/.test(token)) {
      setError('Enter the code from your email');
      return;
    }

    setLoading(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    setLoading(false);

    if (verifyError) {
      const msg = verifyError.message.toLowerCase();
      // Supabase returns the same "expired or invalid" message for a mistyped
      // code and an expired one, so don't claim to know which it was.
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('token')) {
        setError('That code didn’t work — it may be mistyped or expired. Re-enter it, or tap “Resend code.”');
      } else {
        setError(verifyError.message);
      }
    }
    // No success branch needed — onAuthStateChange in App.jsx swaps the screen.
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    setCode('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (authError) {
      setError(
        authError.message.toLowerCase().includes('rate limit')
          ? 'Please wait a minute before requesting another code.'
          : authError.message
      );
    } else {
      setInfo('New code sent.');
    }
  };

  const handleStartOver = () => {
    setStep('request');
    setCode('');
    setError('');
    setInfo('');
  };

  const shell = (children) => (
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
            June 19–23, 2026
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  const errorBox = error && (
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
  );

  const button = (label) => (
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
      {label}
    </button>
  );

  if (step === 'verify') {
    return shell(
      <>
        <form onSubmit={handleVerify}>
          <div style={{ marginBottom: '1.2rem', textAlign: 'center' }}>
            <p style={{ color: THEME.blue, fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
              We emailed a login code to<br />
              <span style={{ color: THEME.gold }}>{email}</span>
            </p>
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label htmlFor="login-code" style={labelStyle}>ENTER CODE</label>
            <input
              id="login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              style={{
                ...inputStyle,
                textAlign: 'center',
                fontSize: '1.6rem',
                letterSpacing: '0.4em',
              }}
            />
          </div>

          {errorBox}
          {info && (
            <div style={{
              color: THEME.gold, fontSize: '0.8rem', textAlign: 'center', marginBottom: '1rem',
            }}>
              {info}
            </div>
          )}

          {button(loading ? 'Verifying...' : 'Enter Journal')}
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            style={{
              background: 'none', border: 'none', color: THEME.blue,
              fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Resend code
          </button>
          <button
            type="button"
            onClick={handleStartOver}
            style={{
              background: 'none', border: 'none', color: THEME.blueMuted,
              fontFamily: 'inherit', fontSize: '0.75rem', cursor: 'pointer',
            }}
          >
            Use a different email
          </button>
        </div>
      </>
    );
  }

  return shell(
    <>
      <form onSubmit={handleSendCode}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="login-email" style={labelStyle}>YOUR EMAIL</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={inputStyle}
          />
        </div>

        {errorBox}

        {button(loading ? 'Sending...' : 'Send Login Code')}
      </form>

      <p style={{ textAlign: 'center', color: THEME.blueMuted, fontSize: '0.75rem', marginTop: '1.5rem', lineHeight: 1.5 }}>
        Enter your email and we'll send you<br />a login code to log in.
      </p>
    </>
  );
}
