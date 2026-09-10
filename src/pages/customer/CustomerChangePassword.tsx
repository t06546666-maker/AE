import { useState, type FormEvent } from 'react';
import { Languages, LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../api';

export function CustomerChangePassword({ onChanged }: { onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t('password.mismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth/customer/change-password', {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      });
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Password change failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="password-gate">
      <form className="password-card" onSubmit={submit}>
        <div className="password-card-head">
          <div className="password-lock"><LockKeyhole /></div>
          <label className="login-language">
            <Languages size={17} />
            <select
              value={i18n.language.startsWith('ml') ? 'ml' : 'en'}
              onChange={(event) => void i18n.changeLanguage(event.target.value)}
            >
              <option value="en">EN</option>
              <option value="ml">മലയാളം</option>
            </select>
          </label>
        </div>
        <div className="login-mobile-brand password-brand">Affiliate <span>AE</span></div>
        <h1>Setup Your Password</h1>
        <p>You must set a permanent password for your customer account to continue.</p>
        <label>
          New Password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label>
          {t('password.confirm')}
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <small className="password-help">Password must be at least 8 characters long.</small>
        {error ? <div className="form-error">{error}</div> : null}
        <button className="button primary login-button" disabled={busy}>
          {busy ? t('password.changing') : t('password.change')}
        </button>
      </form>
    </div>
  );
}
