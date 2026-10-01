import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { apiFetch } from '../api';
import { LoadingState, ErrorState, PageHeader, EmptyState } from '../components/Common';
import { useState, type FormEvent } from 'react';

function AddFieldManager() {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [created, setCreated] = useState('');
  const create = useMutation({
    mutationFn: () => apiFetch('/api/admin/field-managers', { method: 'POST', body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password }) }),
    onSuccess: () => { setCreated(email.trim()); setFullName(''); setEmail(''); setPassword(''); void qc.invalidateQueries({ queryKey: ['admin-field-managers'] }); },
  });
  function submit(event: FormEvent) { event.preventDefault(); setCreated(''); create.mutate(); }
  return <section className="panel"><h2>Add Field Manager</h2><p>Create an account, then share its email, password and the field portal link with your manager.</p>
    <p><a href="/field" target="_blank" rel="noopener noreferrer">Open Field Manager portal ↗</a> · Use a separate browser profile to sign in as the manager while keeping Admin open.</p>
    <form onSubmit={submit}><div className="three-column-form">
      <label>Full name<input required maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} /></label>
      <label>Email<input required type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input required type="password" autoComplete="new-password" minLength={10} value={password} onChange={e => setPassword(e.target.value)} /></label>
    </div><p>At least 10 characters, including uppercase, lowercase, a number and a symbol.</p>
    {create.error && <p role="alert" className="form-error">{create.error.message}</p>}
    {created && <p role="status">Account created for {created}. Sign in at /field using the password you set.</p>}
    <button className="button primary" disabled={create.isPending}>{create.isPending ? 'Creating account…' : 'Add Field Manager'}</button></form></section>;
}

export function FieldManagers() {
  return <><AddFieldManager /><FieldManagerReport /></>;
}

function FieldManagerReport() {
  const qc = useQueryClient(); const query = useQuery({ queryKey: ['admin-field-managers'], queryFn: () => apiFetch<{ managers: Array<{ id: string; full_name: string; created_at: string }>; sessions: Array<{ manager_id: string; login_at: string; logout_at?: string }>; updates: Array<{ id: string; status: string; created_at: string; merchants?: { name?: string }; profiles?: { full_name?: string }; payload?: Record<string, unknown> }> }>('/api/admin/field-managers') });
  const review = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/api/admin/field-updates/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-field-managers'] }) });
  if (query.isPending) return <LoadingState />; if (query.isError) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const active = query.data.sessions.filter(s => !s.logout_at).length;
  return <div className="dashboard-page"><PageHeader title="Field Managers" subtitle="Attendance, merchant visits, and pending merchant updates." /><div className="stats-grid"><div className="stat-card"><strong>{query.data.managers.length}</strong><span>Managers</span></div><div className="stat-card"><strong>{active}</strong><span>Active sessions</span></div><div className="stat-card"><strong>{query.data.updates.filter(u => u.status === 'pending').length}</strong><span>Pending updates</span></div></div><section className="panel"><h2>Managers</h2><div className="table-scroll"><table><thead><tr><th>Name</th><th>Last session</th><th>Status</th></tr></thead><tbody>{query.data.managers.map(m => { const session = query.data.sessions.find(s => s.manager_id === m.id); return <tr key={m.id}><td>{m.full_name}</td><td>{session ? new Date(session.login_at).toLocaleString() : 'No sessions'}</td><td>{session && !session.logout_at ? <span className="tag success">Active</span> : <span className="tag muted">Offline</span>}</td></tr>; })}</tbody></table></div>{!query.data.managers.length ? <EmptyState>No field managers created yet.</EmptyState> : null}</section><section className="panel"><h2>Merchant updates awaiting approval</h2><div className="table-scroll"><table><thead><tr><th>Merchant</th><th>Manager</th><th>Submitted</th><th>Action</th></tr></thead><tbody>{query.data.updates.filter(u => u.status === 'pending').map(u => <tr key={u.id}><td>{u.merchants?.name || 'Merchant'}</td><td>{u.profiles?.full_name || 'Manager'}</td><td>{new Date(u.created_at).toLocaleString()}</td><td><button className="icon-button" title="Approve" onClick={() => review.mutate({ id: u.id, status: 'approved' })}><Check /></button><button className="icon-button danger-icon" title="Reject" onClick={() => review.mutate({ id: u.id, status: 'rejected' })}><X /></button></td></tr>)}</tbody></table></div></section></div>;
}
