import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import type { UserProfile } from '../types';
import { ErrorState, LoadingState } from './Common';
import '../pages/legal.css';

const LegalDetails = lazy(() => import('../pages/Legal').then(module => ({ default: module.LegalDetails })));

type Status = { enabled: boolean; accepted: boolean; termsVersion: string; privacyVersion: string };
export function LegalGate({ user, onLogout, children, preview = false }: { user: UserProfile; onLogout: () => void; children: ReactNode; preview?: boolean }) {
  const endpoint = user.role === 'customer' ? '/api/customer/legal' : '/api/profile/legal';
  const cache = useQueryClient();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['legal-acceptance', user.id, user.role, preview], queryFn: () => preview ? Promise.resolve<Status>({ enabled: true, accepted: false, termsVersion: '2026-10-13-v2', privacyVersion: '2026-10-13-v2' }) : apiFetch<Status>(endpoint), retry: false });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <><ErrorState error={query.error} retry={() => void query.refetch()} /><button onClick={onLogout}>Sign out</button></>;
  if (!query.data.enabled || query.data.accepted || user.role === 'admin') return <>{children}</>;
  const type = user.role === 'field_manager' ? 'field' : user.role;
  const roleName = user.role === 'merchant' ? 'Merchant' : user.role === 'customer' ? 'Customer' : 'Field manager';
  async function accept() {
    if (!terms || !privacy || !consent || saving || !query.data) return;
    if (preview) { setError('Preview only — no acceptance has been saved.'); return; }
    setSaving(true); setError('');
    try {
      await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ termsVersion: query.data.termsVersion, privacyVersion: query.data.privacyVersion, termsAccepted: true, privacyAcknowledged: true, serviceConsent: true }) });
      await cache.invalidateQueries({ queryKey: ['legal-acceptance', user.id, user.role] });
    } catch (e) { setError(e instanceof Error ? e.message : 'Acceptance could not be saved.'); }
    finally { setSaving(false); }
  }
  return <main className="ae-legal ae-consent">
    {preview && <aside>Local preview only — no account data is used or saved. <a href="/consent-preview?role=merchant">Merchant view</a> · <a href="/consent-preview?role=customer">Customer view</a></aside>}
    <header><img src="/logo.png" alt="AE" /><h1>{roleName} privacy & consent</h1><p>Before entering AE, review these details. This applies to self-registration and accounts created by our team.</p></header>
    <section><h2>How your data is used</h2><p>{user.role === 'merchant' ? 'AE uses your business and contact details to manage your account, publish listings and offers, and record purchases and points. Authorised staff can access records needed to support the service. Use customer information only for authorised transactions, not unrelated marketing.' : user.role === 'customer' ? 'AE uses your profile and contact details to manage your account, identify you in QR transactions, and record purchases and reward points. Participating merchants receive the customer details needed for your transactions. Authorised staff can access records needed to support the service.' : 'AE uses your work account, attendance and visit records for work management. Location sharing requires separate device permission.'}</p><p>These checkboxes do not grant camera, location, notification or optional marketing permissions. Device permissions are requested separately when needed.</p><p>For privacy questions, correction or deletion requests, contact <a href="mailto:safar@affiliateinnovations.co.in">safar@affiliateinnovations.co.in</a>.</p></section>
    <details><summary>Read {roleName} Terms & Conditions · {query.data.termsVersion}</summary><Suspense fallback={<p>Loading document…</p>}><LegalDetails type={type} /></Suspense></details>
    <details><summary>Read Privacy Policy · {query.data.privacyVersion}</summary><Suspense fallback={<p>Loading document…</p>}><LegalDetails type="privacy" /></Suspense></details>
    <div className="ae-consent-checks">
      <label><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} /> I agree to the Terms & Conditions for my account.</label>
      <label><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} /> I have read and acknowledge the Privacy Policy.</label>
      <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I consent to the use of my account and transaction data for the AE service as explained above.</label>
    </div>
    <p>Your acceptance is recorded against your account and document versions. New versions require another review. You can decline and sign out.</p>
    {error && <p role="alert">{error}</p>}
    <div className="ae-consent-actions"><button disabled={!terms || !privacy || !consent || saving} onClick={() => void accept()}>{saving ? 'Saving…' : 'Agree & Continue'}</button><button onClick={onLogout} disabled={saving}>Decline & Sign Out</button></div>
  </main>;
}
