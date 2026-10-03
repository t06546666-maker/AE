import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import type { UserProfile } from '../types';
import { ErrorState, LoadingState } from './Common';

type Status = { enabled: boolean; accepted: boolean; termsVersion: string; privacyVersion: string };
export function LegalGate({ user, onLogout, children }: { user: UserProfile; onLogout: () => void; children: ReactNode }) {
  const endpoint = user.role === 'customer' ? '/api/customer/legal' : '/api/profile/legal';
  const cache = useQueryClient();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['legal-acceptance', user.id, user.role], queryFn: () => apiFetch<Status>(endpoint), retry: false });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  if (!query.data.enabled || query.data.accepted || user.role === 'admin') return <>{children}</>;
  const type = user.role === 'field_manager' ? 'field' : user.role;
  return <main className="ae-legal"><img src="/logo.png" alt="AE" width={90} /><h1>Terms &amp; Privacy</h1><p>Before using your account, review the documents below. Only you can accept for your account.</p><p><a href={`/legal?type=${type}`} target="_blank" rel="noopener noreferrer">Read your Terms ({query.data.termsVersion}) ↗</a></p><p><a href="/legal?type=privacy" target="_blank" rel="noopener noreferrer">Read the Privacy Policy ({query.data.privacyVersion}) ↗</a></p><label style={{ display: 'block', margin: '20px 0' }}><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} /> I agree to the Terms for my role.</label><label style={{ display: 'block', margin: '20px 0' }}><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} /> I have read and acknowledge the Privacy Policy.</label><p>Optional marketing and device permissions are separate from this acknowledgement.</p>{error && <p role="alert">{error}</p>}<button disabled={!terms || !privacy || saving} onClick={async () => { setSaving(true); setError(''); try { await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ termsVersion: query.data.termsVersion, privacyVersion: query.data.privacyVersion, termsAccepted: true, privacyAcknowledged: true }) }); await cache.invalidateQueries({ queryKey: ['legal-acceptance', user.id, user.role] }); } catch (e) { setError(e instanceof Error ? e.message : 'Acceptance could not be saved.'); } finally { setSaving(false); } }}>{saving ? 'Saving…' : 'Accept & Continue'}</button><button onClick={onLogout} disabled={saving}>Decline & Sign Out</button></main>;
}
