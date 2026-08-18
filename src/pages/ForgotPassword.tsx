import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';

export function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess(false);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to send reset link');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-brand-panel">
        <div className="login-brand"><span>Affiliate</span><small>AE</small></div>
        <h1>Password Reset</h1>
        <p>Recover access to your account by entering your email address below.</p>
      </div>
      <div className="login-form-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="login-mobile-brand">Affiliate <span>AE</span></div>
          <h2>Forgot Password?</h2>
          <p>We'll send a password reset link to your email.</p>

          {success ? (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '15px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px' }}>
              If an account exists with that email, a password reset link has been sent. Please check your inbox.
            </div>
          ) : (
            <>
              <label>
                {t('login.email')}
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </label>
              {error ? <div className="form-error">{error}</div> : null}
              <button className="button primary login-button" disabled={busy}>
                {busy ? 'Sending...' : 'Send Reset Link'}
              </button>
            </>
          )}

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Link to="/login" style={{ fontSize: '14px', color: 'var(--brand-color)', textDecoration: 'none' }}>
              Return to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
