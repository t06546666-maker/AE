import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Copy, Check, X } from 'lucide-react';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import { useToast } from '../toast';

interface CredentialResult {
  success: boolean;
  managerId: string;
  fullName: string;
  loginEmail: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
}

interface AdminResetFieldManagerPasswordProps {
  id: string;
  name: string;
  email?: string;
  variant?: 'button' | 'icon';
}

export function AdminResetFieldManagerPassword({
  id,
  name,
  email,
  variant = 'button',
}: AdminResetFieldManagerPasswordProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [credentials, setCredentials] = useState<CredentialResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const client = useQueryClient();
  const { showToast } = useToast();

  const resetMutation = useMutation({
    mutationFn: () =>
      apiFetch<CredentialResult>(`/api/admin/field-managers/${encodeURIComponent(id)}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          password: customPassword.trim() || undefined,
        }),
      }),
    onSuccess: (data) => {
      setConfirmOpen(false);
      setCustomPassword('');
      setCredentials(data);
      showToast(uiText('Password reset successfully.'));
      void client.invalidateQueries({ queryKey: ['admin-field-managers'] });
      void client.invalidateQueries({ queryKey: ['read-profile', 'manager', id] });
    },
  });

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showToast(uiText('Copied to clipboard'));
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      showToast(uiText('Failed to copy'), 'error');
    }
  };

  const copyAll = async () => {
    if (!credentials) return;
    const portalUrl = `${window.location.origin}/field`;
    const fullText = [
      `Field Manager Portal: ${portalUrl}`,
      `Name: ${credentials.fullName}`,
      `Login Email: ${credentials.loginEmail}`,
      `Temporary Password: ${credentials.temporaryPassword}`,
      `Must change password upon login: Yes`,
    ].join('\n');
    await copyToClipboard(fullText, 'all');
  };

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          className="icon-button"
          title={uiText('Reset password')}
          aria-label={`${uiText('Reset password for')} ${name}`}
          onClick={() => {
            setConfirmOpen(true);
            setCustomPassword('');
            resetMutation.reset();
          }}
        >
          <KeyRound size={18} />
        </button>
      ) : (
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setConfirmOpen(true);
            setCustomPassword('');
            resetMutation.reset();
          }}
        >
          <KeyRound size={16} />
          {uiText('Reset password')}
        </button>
      )}

      {/* Confirmation & Options Modal */}
      {confirmOpen && (
        <div className="modal-backdrop" onClick={() => !resetMutation.isPending && setConfirmOpen(false)}>
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={uiText('Reset Field Manager Password')}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              resetMutation.mutate();
            }}
          >
            <button
              type="button"
              className="icon-button modal-close"
              title={uiText('Close')}
              disabled={resetMutation.isPending}
              onClick={() => setConfirmOpen(false)}
            >
              <X size={18} />
            </button>
            <h2>{uiText('Reset Field Manager Password')}</h2>
            <strong>{name}</strong>
            {email ? <p style={{ margin: '4px 0 12px', fontSize: '13px', color: 'var(--muted)' }}>{email}</p> : null}
            <p>
              {uiText(
                'This will reset the login password and generate a secure temporary password. The Field Manager will be required to change their password when signing in at /field.'
              )}
            </p>

            <label style={{ display: 'grid', gap: '6px', margin: '14px 0' }}>
              <span>{uiText('Custom temporary password (optional)')}</span>
              <input
                type="text"
                autoComplete="off"
                placeholder={uiText('Leave blank to auto-generate a secure password')}
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                disabled={resetMutation.isPending}
              />
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                {uiText('If entered, must be at least 8 characters with at least one uppercase letter.')}
              </small>
            </label>

            {resetMutation.error && (
              <p role="alert" className="form-error" style={{ color: 'var(--danger)', margin: '8px 0' }}>
                {resetMutation.error.message}
              </p>
            )}

            <div className="modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '18px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="button secondary"
                disabled={resetMutation.isPending}
                onClick={() => setConfirmOpen(false)}
              >
                {uiText('Cancel')}
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? uiText('Resetting…') : uiText('Reset password')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Credentials Modal */}
      {credentials && (
        <div className="modal-backdrop" onClick={() => setCredentials(null)}>
          <div
            className="modal credentials-modal"
            role="dialog"
            aria-modal="true"
            aria-label={uiText('Field Manager Credentials')}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="icon-button modal-close"
              title={uiText('Close')}
              onClick={() => setCredentials(null)}
            >
              <X size={18} />
            </button>
            <h2>{uiText('Field Manager Credentials')}</h2>
            <p>
              {uiText(
                'Share these new temporary credentials with the Field Manager. They can sign in at /field and update their password.'
              )}
            </p>

            <div className="credential-row">
              <span>{uiText('Portal Link')}</span>
              <strong>{`${window.location.origin}/field`}</strong>
              <button
                type="button"
                className="icon-button"
                title={uiText('Copy')}
                onClick={() => void copyToClipboard(`${window.location.origin}/field`, 'portal')}
              >
                {copiedKey === 'portal' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <div className="credential-row">
              <span>{uiText('Login Email')}</span>
              <strong>{credentials.loginEmail}</strong>
              <button
                type="button"
                className="icon-button"
                title={uiText('Copy')}
                onClick={() => void copyToClipboard(credentials.loginEmail, 'email')}
              >
                {copiedKey === 'email' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <div className="credential-row sensitive">
              <span>{uiText('Temporary Password')}</span>
              <strong>{credentials.temporaryPassword}</strong>
              <button
                type="button"
                className="icon-button"
                title={uiText('Copy')}
                onClick={() => void copyToClipboard(credentials.temporaryPassword, 'password')}
              >
                {copiedKey === 'password' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => void copyAll()}
              >
                {copiedKey === 'all' ? <Check size={16} /> : <Copy size={16} />}
                {copiedKey === 'all' ? uiText('Copied all!') : uiText('Copy all credentials')}
              </button>
              <button
                type="button"
                className="button primary"
                style={{ flex: 1 }}
                onClick={() => setCredentials(null)}
              >
                {uiText('Done')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

