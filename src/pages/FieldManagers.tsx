import { uiText } from '../uiText';
import { formatDateTime } from '../utils';
import { Link } from 'react-router-dom';
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
  return <section className="panel"><h2>{uiText("Add Field Manager")}</h2><p>{uiText("Create an account, then share its email, password and the field portal link with your manager.")}</p>
    <p><a href="/field" target="_blank" rel="noopener noreferrer">{uiText("Open Field Manager portal ↗")}</a>{uiText(" · Use a separate browser profile to sign in as the manager while keeping Admin open.")}</p>
    <form onSubmit={submit}><div className="three-column-form">
      <label>{uiText("Full name")}<input required maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} /></label>
      <label>{uiText("Email")}<input required type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>{uiText("Password")}<input required type="password" autoComplete="new-password" minLength={10} value={password} onChange={e => setPassword(e.target.value)} /></label>
    </div><p>{uiText("At least 10 characters, including uppercase, lowercase, a number and a symbol.")}</p>
    {create.error && <p role="alert" className="form-error">{create.error.message}</p>}
    {created && <p role="status">{uiText("Account created for ")}{created}{uiText(". Sign in at /field using the password you set.")}</p>}
    <button className="button primary" disabled={create.isPending}>{create.isPending ? uiText("Creating account…") : uiText("Add Field Manager")}</button></form></section>;
}

export function FieldManagers() {
  return <><AddFieldManager /><FieldManagerReport /></>;
}

function FieldManagerReport() {
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/field-managers/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin-field-managers'] }); },
  });
  const qc = useQueryClient(); const query = useQuery({ queryKey: ['admin-field-managers'], queryFn: () => apiFetch<{ managers: Array<{ id: string; full_name: string; created_at: string }>; sessions: Array<{ manager_id: string; login_at: string; logout_at?: string }>; updates: Array<{ id: string; status: string; created_at: string; merchants?: { name?: string }; profiles?: { full_name?: string }; payload?: Record<string, unknown> }> }>('/api/admin/field-managers') });
  const review = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/api/admin/field-updates/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-field-managers'] }) });
  if (query.isPending) return <LoadingState />; if (query.isError) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const active = query.data.sessions.filter(s => !s.logout_at).length;
  return <div className="dashboard-page"><PageHeader title={uiText("Field Managers")} subtitle="Attendance, merchant visits, and pending merchant updates." />{remove.error && <p role="alert">{remove.error.message}</p>}<div className="stats-grid"><div className="stat-card"><strong>{query.data.managers.length}</strong><span>{uiText("Managers")}</span></div><div className="stat-card"><strong>{active}</strong><span>{uiText("Active sessions")}</span></div><div className="stat-card"><strong>{query.data.updates.filter(u => u.status === 'pending').length}</strong><span>{uiText("Pending updates")}</span></div></div><section className="panel"><h2>{uiText("Managers")}</h2><div className="table-scroll"><table><thead><tr><th>{uiText("Name")}</th><th>{uiText("Last session")}</th><th>{uiText("Status")}</th><th>{uiText("Action")}</th></tr></thead><tbody>{query.data.managers.map(m => { const session = query.data.sessions.find(s => s.manager_id === m.id); return <tr key={m.id}><td><Link to={`/field-managers/${m.id}`}>{m.full_name}{uiText(" · View Profile")}</Link></td><td>{session ? formatDateTime(session.login_at) : uiText("No sessions")}</td><td>{session && !session.logout_at ? <span className="tag success">{uiText("Active")}</span> : <span className="tag muted">{uiText("Offline")}</span>}</td><td><button className="button secondary" disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete ${m.full_name}? This permanently removes their login, visits, sessions and submitted field updates.`)) remove.mutate(m.id); }}>{uiText("Delete")}</button></td></tr>; })}</tbody></table></div>{!query.data.managers.length ? <EmptyState>{uiText("No field managers created yet.")}</EmptyState> : null}</section><section className="panel"><h2>{uiText("Merchant updates awaiting approval")}</h2><div className="table-scroll"><table><thead><tr><th>{uiText("Merchant")}</th><th>{uiText("Manager")}</th><th>{uiText("Submitted")}</th><th>{uiText("Action")}</th></tr></thead><tbody>{query.data.updates.filter(u => u.status === 'pending').map(u => <tr key={u.id}><td>{u.merchants?.name || 'Merchant'}</td><td>{u.profiles?.full_name || 'Manager'}</td><td>{formatDateTime(u.created_at)}</td><td><button className="icon-button" title={uiText("Approve")} onClick={() => review.mutate({ id: u.id, status: 'approved' })}><Check /></button><button className="icon-button danger-icon" title={uiText("Reject")} onClick={() => review.mutate({ id: u.id, status: 'rejected' })}><X /></button></td></tr>)}</tbody></table></div></section></div>;
}
