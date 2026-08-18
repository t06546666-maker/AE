import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Eye, EyeOff, Languages, Mail, ShieldCheck, Sparkles, X } from 'lucide-react';
import { apiFetch, setAccessToken } from '../api';
import type { UserProfile } from '../types';
import { Link } from 'react-router-dom';

export function Login({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<'about' | 'contact' | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
        <h1>{t('login.headline')}</h1>
        <p>{t('login.description')}</p>
        <div className="login-features">
          <div><ShieldCheck /><span><strong>{t('login.roleTitle')}</strong>{t('login.roleText')}</span></div>
          <div><Sparkles /><span><strong>{t('login.rewardsTitle')}</strong>{t('login.rewardsText')}</span></div>
          <div><Building2 /><span><strong>{t('login.networkTitle')}</strong>{t('login.networkText')}</span></div>
        </div>
      </div>
      <div className="login-form-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="login-mobile-brand">Affiliate <span>AE</span></div>
          <label className="login-language"><Languages size={17} /><select value={i18n.language.startsWith('ml') ? 'ml' : 'en'} onChange={(event) => void i18n.changeLanguage(event.target.value)}><option value="en">{t('language.english')}</option><option value="ml">{t('language.malayalam')}</option></select></label>
          <h2>{t('login.welcome')}</h2>
          <p>{t('login.prompt')}</p>
          <label>{t('login.email')}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
          <label>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('login.password')}</span>
              <Link to="/forgot-password" style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--brand-color)', textDecoration: 'none' }}>Forgot password?</Link>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={8} required style={{ width: '100%', paddingRight: '40px' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7280', display: 'flex' }} title={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="button primary login-button" disabled={busy}>{busy ? t('login.signingIn') : t('login.signIn')}</button>
          <div className="login-links"><button type="button" onClick={() => setInfo('about')}>{t('login.about')}</button><button type="button" onClick={() => setInfo('contact')}>{t('login.contact')}</button></div>
        </form>
      </div>
      {info ? (
        <div className="modal-backdrop">
          <div className="modal info-modal">
            <button className="icon-button modal-close" title={t('common.close')} onClick={() => setInfo(null)}><X /></button>
            {info === 'about' ? <><h2>{t('login.aboutTitle')}</h2><p>{t('login.aboutText')}</p></> : <><h2>{t('login.contactTitle')}</h2><p>{t('login.contactText')}</p><a className="contact-link" href="mailto:safar@affiliateae.co.in"><Mail size={17} />safar@affiliateae.co.in</a></>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
