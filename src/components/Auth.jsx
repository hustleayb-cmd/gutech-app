import { useState } from 'react';
import { supabase } from '../supabase';
import Logo from './Logo';

export default function Auth() {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  async function submit() {
    setErr(''); setOk('');
    if (!email || !password) { setErr('Enter an email and password to continue.'); return; }
    if (password.length < 6) { setErr('Password needs at least 6 characters.'); return; }

    setBusy(true);
    const fn = mode === 'in' ? 'signInWithPassword' : 'signUp';
    const { error } = await supabase.auth[fn]({ email, password });
    setBusy(false);

    if (error) { setErr(error.message); return; }
    if (mode === 'up') setOk('Account created. Check your email if confirmation is switched on, then sign in.');
  }

  return (
    <div className="auth">
      <div className="auth-inner">
        <Logo size="lg" tagline />
        <h2>{mode === 'in' ? 'Sign in' : 'Create an account'}</h2>
        <p className="lede">
          Ask about fees, programmes and campus life. Keep your notes and
          deadlines in the same place.
        </p>

        <div className="auth-card">
          {err && <div className="notice err">{err}</div>}
          {ok && <div className="notice ok">{ok}</div>}

          <label htmlFor="email">Email</label>
          <input
            id="email" type="email" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="you@example.com"
          />

          <label htmlFor="pw">Password</label>
          <input
            id="pw" type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="At least 6 characters"
          />

          <button className="primary" onClick={submit} disabled={busy}>
            {busy ? 'Working…' : mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
        </div>

        <div className="switch">
          {mode === 'in' ? 'No account yet? ' : 'Already registered? '}
          <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setOk(''); }}>
            {mode === 'in' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
