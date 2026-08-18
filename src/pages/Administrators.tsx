import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/Common';
import type { Administrator } from '../types';
import { formatDate } from '../utils';
import { useToast } from '../toast';

export function Administrators() {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const queryClient = useQueryClient(); const { showToast } = useToast();
  const admins = useQuery({ queryKey: ['administrators'], queryFn: ({ signal }) => apiFetch<{ admins: Administrator[] }>('/api/admins', { signal }) });
  const create = useMutation({ mutationFn: () => apiFetch('/api/admins', { method: 'POST', body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password }) }), onSuccess() { setFullName(''); setEmail(''); setPassword(''); showToast(t('admins.created')); void queryClient.invalidateQueries({ queryKey: ['administrators'] }); }, onError(error) { showToast(error.message, 'error'); } });
  const remove = useMutation({ mutationFn: (admin: Administrator) => apiFetch(`/api/admins/${admin.id}`, { method: 'DELETE' }), onSuccess() { showToast(t('admins.removed')); void queryClient.invalidateQueries({ queryKey: ['administrators'] }); }, onError(error) { showToast(error.message, 'error'); } });
  function submit(event: FormEvent) { event.preventDefault(); create.mutate(); }
  function deleteAdmin(admin: Administrator) { if (window.confirm(t('admins.removeConfirm', { name: admin.fullName }))) remove.mutate(admin); }
  return <><PageHeader title={t('admins.title')} subtitle={t('admins.subtitle')} /><form className="panel" onSubmit={submit}><div className="panel-heading"><div><h2>{t('admins.add')}</h2><p>{t('admins.help')}</p></div><ShieldCheck /></div><div className="three-column-form"><label>{t('admins.fullName')}<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label><label>{t('layout.email')}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>{t('admins.tempPassword')}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label></div><button className="button primary" disabled={create.isPending}><Plus size={16} />{t(create.isPending ? 'admins.creating' : 'admins.add')}</button></form>{admins.isPending ? <LoadingState /> : admins.isError ? <ErrorState error={admins.error} retry={() => admins.refetch()} /> : <section className="table-panel"><div className="table-scroll"><table><thead><tr><th>{t('registration.name')}</th><th>{t('layout.email')}</th><th>{t('admins.createdAt')}</th><th>{t('admins.action')}</th></tr></thead><tbody>{admins.data?.admins.map((admin) => <tr key={admin.id}><td><strong>{admin.fullName}</strong>{admin.isCurrent ? <span className="tag violet">{t('admins.you')}</span> : null}</td><td>{admin.email}</td><td>{formatDate(admin.createdAt)}</td><td>{!admin.isCurrent ? <button className="icon-button danger-icon" title={t('admins.remove')} onClick={() => deleteAdmin(admin)}><Trash2 /></button> : null}</td></tr>)}</tbody></table></div>{!admins.data?.admins.length ? <EmptyState>{t('admins.empty')}</EmptyState> : null}</section>}</>;
}
