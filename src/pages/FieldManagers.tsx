import { uiText } from '../uiText';
import { formatDateTime } from '../utils';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, Plus, Search, ChevronRight } from 'lucide-react';
import { apiFetch } from '../api';
import { LoadingState, ErrorState, PageHeader, EmptyState } from '../components/Common';
import { useState, type FormEvent } from 'react';
import '../admin-directory.css';

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
  const [adding,setAdding]=useState(false);
  return <div className="admin-directory-page"><PageHeader title={uiText('Field Managers')} subtitle={uiText('Field operations, attendance and merchant onboarding')} actions={<button className="button primary" aria-expanded={adding} onClick={()=>setAdding(!adding)}><Plus size={16}/>{uiText(adding?'Close form':'Add Field Manager')}</button>}/>{adding&&<AddFieldManager/>}<FieldManagerReport/></div>;
}

function FieldManagerReport() {
  const [search,setSearch]=useState('');
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/field-managers/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin-field-managers'] }); },
  });
  const qc = useQueryClient(); const query = useQuery({ queryKey: ['admin-field-managers'], queryFn: () => apiFetch<{ managers: Array<{ id: string; full_name: string; created_at: string }>; sessions: Array<{ manager_id: string; login_at: string; logout_at?: string }>; updates: Array<{ id: string; status: string; created_at: string; merchants?: { name?: string }; profiles?: { full_name?: string }; payload?: Record<string, unknown> }> }>('/api/admin/field-managers') });
  const review = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/api/admin/field-updates/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-field-managers'] }) });
  if (query.isPending) return <LoadingState />; if (query.isError) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const matching=query.data.managers.filter(manager=>manager.full_name.toLowerCase().includes(search.trim().toLowerCase()));
  const pending=query.data.updates.filter(update=>update.status==='pending');
  return <>{remove.error&&<p role="alert">{remove.error.message}</p>}{review.error&&<p role="alert">{review.error.message}</p>}<div className="admin-directory-metrics"><article><span>{uiText('Registered field managers')}</span><strong>{query.data.managers.length}</strong></article><article><span>{uiText('Matching managers')}</span><strong>{matching.length}</strong></article><article><span>{uiText('Pending updates in loaded records')}</span><strong>{pending.length}</strong></article></div><div className="list-toolbar"><label className="search-field"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={uiText('Search field managers')} aria-label={uiText('Search field managers')}/></label></div><section className="table-panel"><div className="table-scroll"><table><thead><tr>{['Manager','Joined','Last recorded session','Session record','Actions'].map(label=><th key={label}>{uiText(label)}</th>)}</tr></thead><tbody>{matching.map(m=>{const session=query.data.sessions.find(s=>s.manager_id===m.id);return <tr key={m.id}><td><Link className="admin-merchant-name" to={`/field-managers/${m.id}`}><span className="admin-directory-avatar">{m.full_name.slice(0,1)}</span><strong>{m.full_name}</strong></Link></td><td>{formatDateTime(m.created_at)}</td><td>{session?formatDateTime(session.login_at):uiText('No sessions in loaded records')}</td><td><span className="admin-source-badge">{uiText(!session?'Not recorded':session.logout_at?'Closed':'No logout recorded')}</span></td><td><div className="table-actions"><Link className="icon-button" aria-label={`${uiText('View manager')} ${m.full_name}`} to={`/field-managers/${m.id}`}><ChevronRight size={18}/></Link><button className="button secondary" disabled={remove.isPending} onClick={()=>{if(window.confirm(`Delete ${m.full_name}? This permanently removes their login, visits, sessions and submitted field updates.`))remove.mutate(m.id);}}>{uiText('Delete')}</button></div></td></tr>;})}</tbody></table></div>{!matching.length&&<EmptyState>{uiText('No matching field managers.')}</EmptyState>}<p className="admin-directory-note" style={{padding:16}}>{uiText('Session and update summaries cover the latest 200 loaded records. A session without logout does not prove the manager is online.')}</p></section><section className="panel"><h2>{uiText('Merchant updates awaiting approval')}</h2><div className="table-scroll"><table><thead><tr>{['Merchant','Manager','Submitted','Action'].map(label=><th key={label}>{uiText(label)}</th>)}</tr></thead><tbody>{pending.map(u=><tr key={u.id}><td>{u.merchants?.name||uiText('Merchant')}</td><td>{u.profiles?.full_name||uiText('Manager')}</td><td>{formatDateTime(u.created_at)}</td><td><div className="table-actions"><button className="icon-button" disabled={review.isPending} title={uiText('Approve')} onClick={()=>review.mutate({id:u.id,status:'approved'})}><Check/></button><button className="icon-button danger-icon" disabled={review.isPending} title={uiText('Reject')} onClick={()=>review.mutate({id:u.id,status:'rejected'})}><X/></button></div></td></tr>)}</tbody></table></div>{!pending.length&&<p>{uiText('No pending updates in loaded records.')}</p>}</section></>;
}
