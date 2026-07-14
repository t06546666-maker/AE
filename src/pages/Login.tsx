import { useState, type FormEvent } from 'react';
import { Building2, Mail, ShieldCheck, Sparkles, X } from 'lucide-react';
import { apiFetch, setAccessToken } from '../api';
import type { UserProfile } from '../types';

export function Login({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<'about' | 'contact' | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await apiFetch<{ accessToken: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST', body: JSON.stringify({ email: email.trim(), password }),
      });
      setAccessToken(data.accessToken);
      onLogin(data.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="login-screen">
      <div className="login-brand-panel">
        <div className="login-brand"><span>Affiliate</span><small>AE</small></div>
        <h1>Rewards that bring customers back.</h1>
        <p>One operational workspace for customer QR checkout, reward points, retention, and merchant reporting.</p>
        <div className="login-features">
          <div><ShieldCheck /><span><strong>Role-secured</strong>Admin and merchant access</span></div>
          <div><Sparkles /><span><strong>Instant rewards</strong>Points calculated at checkout</span></div>
          <div><Building2 /><span><strong>Multi-merchant</strong>One customer QR across the network</span></div>
        </div>
      </div>
      <div className="login-form-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="login-mobile-brand">Affiliate <span>AE</span></div>
          <h2>Welcome back</h2>
          <p>Sign in to your secure workspace.</p>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={8} required /></label>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="button primary login-button" disabled={busy}>{busy ? 'Signing in' : 'Sign in securely'}</button>
          <div className="login-links"><button type="button" onClick={() => setInfo('about')}>About</button><button type="button" onClick={() => setInfo('contact')}>Contact</button></div>
        </form>
      </div>
      {info ? (
        <div className="modal-backdrop">
          <div className="modal info-modal">
            <button className="icon-button modal-close" title="Close" onClick={() => setInfo(null)}><X /></button>
            {info === 'about' ? <><h2>About Affiliate AE</h2><p>Affiliate AE helps local merchants register customers, issue purchase-based reward points, scan one reusable customer QR, and measure repeat visits.</p></> : <><h2>Contact</h2><p>For account or merchant support, contact the Affiliate AE team.</p><a className="contact-link" href="mailto:safar@affiliateae.co.in"><Mail size={17} />safar@affiliateae.co.in</a></>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
