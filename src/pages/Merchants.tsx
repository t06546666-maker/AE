import { useDeferredValue, useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { EmptyState, ErrorState, ExportModal, LoadingState, PageHeader, PaginationBar } from '../components/Common';
import type { Merchant, MerchantSummaryResponse, Pagination } from '../types';
import { formatDate, formatPoints } from '../utils';
import { useToast } from '../toast';

export function Merchants() {
  const [page, setPage] = useState(1); const [search, setSearch] = useState('');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState('');
  const deferredSearch = useDeferredValue(search.trim()); const queryClient = useQueryClient(); const { showToast } = useToast();
  useEffect(() => setPage(1), [deferredSearch]);
  const merchants = useQuery({
    queryKey: ['merchants', page, deferredSearch],
    queryFn: ({ signal }) => apiFetch<{ merchants: Merchant[]; pagination: Pagination }>(`/api/merchants?${queryString({ page, pageSize: 20, search: deferredSearch })}`, { signal }),
    placeholderData: (previous) => previous,
  });
  const create = useMutation({
    mutationFn: () => apiFetch('/api/merchants', { method: 'POST', body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), password }) }),
    onSuccess() { setName(''); setEmail(''); setPhone(''); setPassword(''); showToast('Merchant login created'); void queryClient.invalidateQueries({ queryKey: ['merchants'] }); },
    onError(error) { showToast(error.message, 'error'); },
  });
  const remove = useMutation({
    mutationFn: (merchant: Merchant) => apiFetch<{ deletedCustomers?: number }>(`/api/merchants/${encodeURIComponent(merchant.id)}`, { method: 'DELETE' }),
    onSuccess(data) { showToast(data.deletedCustomers ? `Merchant removed · ${data.deletedCustomers} customer records removed` : 'Merchant removed'); void queryClient.invalidateQueries({ queryKey: ['merchants'] }); void queryClient.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError(error) { showToast(error.message, 'error'); },
  });
  function submit(event: FormEvent) { event.preventDefault(); create.mutate(); }
  function deleteMerchant(merchant: Merchant) { if (window.confirm(`Delete ${merchant.name} fully?\n\nThis removes the merchant login, orders, links, and customers that belong only to this merchant.`)) remove.mutate(merchant); }
  return <>
    <PageHeader title="Merchants" subtitle="Manage affiliated stores and open store-level reports." />
    <form className="panel merchant-form" onSubmit={submit}><div className="panel-heading"><div><h2>Add merchant</h2><p>Create a secure merchant login.</p></div><Plus /></div><div className="four-column-form"><label>Store name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Phone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label><label>Temporary password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label></div><button className="button primary" disabled={create.isPending}><Plus size={16} />{create.isPending ? 'Creating' : 'Add merchant'}</button></form>
    <div className="list-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search merchants" /></label></div>
    {merchants.isPending ? <LoadingState label="Loading merchants" /> : merchants.isError ? <ErrorState error={merchants.error} retry={() => merchants.refetch()} /> : <section className="table-panel"><div className="table-scroll"><table><thead><tr><th>Store</th><th>Email</th><th>Phone</th><th>Joined</th><th>Orders</th><th>Actions</th></tr></thead><tbody>{merchants.data?.merchants.map((merchant) => <tr key={merchant.id}><td><strong>{merchant.name}</strong></td><td>{merchant.email}</td><td>{merchant.phone}</td><td>{formatDate(merchant.joined)}</td><td>{merchant.orderCount ?? 0}</td><td><div className="table-actions"><Link className="icon-button" title="View merchant" to={`/merchants/${merchant.id}`}><Eye /></Link><button className="icon-button danger-icon" title="Delete merchant" disabled={remove.isPending} onClick={() => deleteMerchant(merchant)}><Trash2 /></button></div></td></tr>)}</tbody></table></div>{!merchants.data?.merchants.length ? <EmptyState>No merchants found.</EmptyState> : null}<PaginationBar pagination={merchants.data?.pagination} onPage={setPage} /></section>}
  </>;
}

export function MerchantProfile() {
  const { id = '' } = useParams(); const navigate = useNavigate(); const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const summary = useQuery({ queryKey: ['merchant-summary', id], queryFn: ({ signal }) => apiFetch<MerchantSummaryResponse>(`/api/merchants/${encodeURIComponent(id)}/summary`, { signal }), enabled: Boolean(id) });
  if (summary.isPending) return <LoadingState label="Loading merchant profile" />;
  if (summary.isError) return <ErrorState error={summary.error} retry={() => summary.refetch()} />;
  const data = summary.data!; const stats = data.summary;
  return <>
    <PageHeader title={data.merchant.name} subtitle={`${data.merchant.email} · ${data.merchant.phone} · Joined ${formatDate(data.merchant.joined)}`} actions={<><button className="button secondary" onClick={() => setExportFormat('xlsx')}><Download size={16} />Excel</button><button className="button secondary" onClick={() => setExportFormat('pdf')}><Download size={16} />PDF</button><button className="button secondary" onClick={() => navigate('/merchants')}><ArrowLeft size={16} />Back</button></>} />
    <div className="metric-grid merchant-metrics"><article className="metric-card violet"><div><span>Total orders</span><strong>{stats.totalOrders}</strong><small>All time</small></div></article><article className="metric-card blue"><div><span>Points issued</span><strong>{formatPoints(stats.pointsIssued)}</strong><small>From orders</small></div></article><article className="metric-card pink"><div><span>Customers</span><strong>{stats.totalCustomers}</strong><small>Linked to this merchant</small></div></article><article className="metric-card green"><div><span>Retention</span><strong>{stats.retainedCustomers}</strong><small>{stats.retentionRate}% retained</small></div></article></div>
    <section className="panel"><div className="panel-heading"><div><h2>Merchant customers</h2><p>Orders, points, and retention for this store only.</p></div></div><div className="profile-customer-list">{data.customers.map((customer) => <div className="profile-customer" key={customer.databaseId}><div><strong>{customer.name}</strong><small>{customer.id} · {formatPhoneSafe(customer.phone)}</small></div><span><small>Orders</small><strong>{customer.orderCount || 0}</strong></span><span><small>Balance</small><strong className="points-text">{formatPoints(customer.rewardPoints)} pts</strong></span><span className={`tag ${customer.isRetained ? 'success' : 'info'}`}>{customer.isRetained ? 'Returning' : 'New'}</span></div>)}</div>{!data.customers.length ? <EmptyState>No customers linked to this merchant.</EmptyState> : null}</section>
    <ExportModal open={Boolean(exportFormat)} format={exportFormat || 'xlsx'} merchantId={id} isAdmin onClose={() => setExportFormat(null)} />
  </>;
}

function formatPhoneSafe(value: string) { const digits = String(value || '').replace(/\D/g, '').slice(-10); return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : value; }
