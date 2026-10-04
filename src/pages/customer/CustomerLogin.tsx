import { AuthShell } from '../../components/AuthShell';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, setAccessToken } from '../../api';
import { UserProfile } from '../../types';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Eye, EyeOff, Languages, LockKeyhole, Phone } from 'lucide-react';

export function CustomerLogin({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { i18n } = useTranslation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fullPhone = '+91' + phone.replace(/\D/g, '');
      const data = await apiFetch<{ accessToken: string; refreshToken?: string; user: UserProfile }>('/api/auth/customer/login', {
        method: 'POST',
        body: JSON.stringify({ phone: fullPhone, password }),
      });
      setAccessToken(data.accessToken, data.refreshToken);
      onLogin(data.user);
    } catch (err: any) {
      setError(err.message || 'Invalid phone or password.');
    } finally {
      setLoading(false);
    }
  };

  return <AuthShell>
    <div className="ae-auth-language"><Languages size={16}/><select aria-label="Language" value={i18n.language.startsWith('ml') ? 'ml' : 'en'} onChange={e => void i18n.changeLanguage(e.target.value)}><option value="en">English</option><option value="ml">മലയാളം</option></select></div>
    <h1>Welcome back</h1><p className="ae-auth-subtitle">Login to your AE account</p>
    <form onSubmit={submit}>
      <label className="ae-auth-field"><Phone /><input aria-label="Mobile number" type="tel" autoComplete="username" placeholder="+91 · Mobile number" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required /></label>
      <label className="ae-auth-field"><LockKeyhole/><input aria-label="Password" placeholder="Password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <Eye/> : <EyeOff/>}</button></label>
      <Link className="ae-auth-forgot" to="/customer/forgot-password">Forgot password?</Link>
      {error && <div role="alert" className="form-error">{error}</div>}
      <button className="ae-auth-primary" disabled={loading}>{loading ? 'Signing in…' : 'Login'}<ArrowRight/></button>
    </form>
    <p className="ae-auth-bottom">New to AE? <Link to="/customer/signup">Create Account</Link></p>
  </AuthShell>;
}
