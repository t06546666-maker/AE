import { AuthShell } from '../components/AuthShell';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Eye, EyeOff, Languages, LockKeyhole, Store } from 'lucide-react';
import { apiFetch, setAccessToken } from '../api';
import type { UserProfile } from '../types';
import { Link } from 'react-router-dom';

export function Login({ onLogin, field = false }: { onLogin: (user: UserProfile) => void; field?: boolean }) {
  const { i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await apiFetch<{ accessToken: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST', body: JSON.stringify({ email: email.trim(), password }),
      });
      if (field && data.user.role !== 'field_manager') throw new Error('Use the field manager account created by your admin.');
      setAccessToken(data.accessToken);
      onLogin(data.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed');
    } finally { setBusy(false); }
  }

  return <AuthShell merchant>
    <div className="ae-auth-language"><Languages size={16}/><select aria-label="Language" value={i18n.language.startsWith('ml') ? 'ml' : 'en'} onChange={e => void i18n.changeLanguage(e.target.value)}><option value="en">English</option><option value="ml">മലയാളം</option></select></div>
    <h1>{field ? 'Field Manager Login' : 'Merchant Login'}</h1><p className="ae-auth-subtitle">{field ? 'Sign in to visit merchants and submit field reports' : 'Manage your store, customers & rewards'}</p>
    <form onSubmit={submit}>
      <label className="ae-auth-field"><Store /><input aria-label="Email" type="email" autoComplete="username" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label className="ae-auth-field"><LockKeyhole/><input aria-label="Password" placeholder="Password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <Eye/> : <EyeOff/>}</button></label>
      <Link className="ae-auth-forgot" to="/forgot-password">Forgot password?</Link>
      {error && <div role="alert" className="form-error">{error}</div>}
      <button className="ae-auth-primary" disabled={busy}>{busy ? 'Signing in…' : 'Login'}<ArrowRight/></button>
    </form>
    <p className="ae-auth-bottom">{field ? 'Ask your admin to create your field manager account.' : <>Field manager? <Link to="/field">Field Manager Login</Link></>}</p>
  </AuthShell>;
}
