import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Download, Eye, MessageCircle, Plus, Search, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, PaginationBar } from '../components/Common';
import type { Customer, Pagination, UserProfile } from '../types';
import { formatCurrency, formatDate, formatPhone, formatPoints, initials, qrPayload } from '../utils';
import { useToast } from '../toast';

function CustomerQrModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState(''); const { showToast } = useToast();
  useEffect(() => { QRCode.toDataURL(qrPayload(customer), { width: 300, margin: 2, errorCorrectionLevel: 'M' }).then(setQrUrl); }, [customer]);
  const send = useMutation({
    mutationFn: (merchantId?: string) => apiFetch('/api/send-qr', { method: 'POST', body: JSON.stringify({ cid: customer.id, merchantId: merchantId || customer.merchantId || customer.memberships?.[0]?.merchantId }) }),
    onSuccess() { showToast('WhatsApp QR message queued'); }, onError(error) { showToast(error.message, 'error'); },
  });
  function download() { if (!qrUrl) return; const anchor = document.createElement('a'); anchor.href = qrUrl; anchor.download = `AE-QR-${customer.id}.png`; anchor.click(); }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal customer-modal"><button className="icon-button modal-close" title="Close" onClick={onClose}><X /></button><h2>Customer QR code</h2><p>One QR can identify this customer across the Affiliate AE merchant network.</p><div className="qr-modal-grid"><div className="result-qr">{qrUrl ? <img src={qrUrl} alt={`QR code for ${customer.name}`} /> : <span>Generating QR...</span>}<strong>{customer.id}</strong></div><div className="result-details"><h3>{customer.name}</h3><p>{formatPhone(customer.phone)}</p><p>{customer.email}</p><dl><div><dt>Orders</dt><dd>{customer.orderCount || 0}</dd></div><div><dt>Points</dt><dd>{formatPoints(customer.totalRewardPoints ?? customer.rewardPoints)}</dd></div><div><dt>Registered</dt><dd>{formatDate(customer.registeredAt)}</dd></div></dl><div className="result-actions"><button className="button whatsapp" disabled={send.isPending} onClick={() => send.mutate(undefined)}><MessageCircle size={16} />Send WhatsApp</button><button className="button secondary" onClick={download}><Download size={16} />Download</button></div></div></div></div></div>;
}

export function Customers({ user }: { user: UserProfile }) {
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [selected, setSelected] = useState<Customer | null>(null);
  const deferredSearch = useDeferredValue(search.trim()); const queryClient = useQueryClient(); const { showToast } = useToast();
  useEffect(() => setPage(1), [deferredSearch]);
  const customers = useQuery({
    queryKey: ['customers', page, deferredSearch],
    queryFn: ({ signal }) => apiFetch<{ customers: Customer[]; pagination: Pagination }>(`/api/customers?${queryString({ page, pageSize: 18, search: deferredSearch })}`, { signal }),
    placeholderData: (previous) => previous,
  });
  const remove = useMutation({
    mutationFn: (customer: Customer) => apiFetch(`/api/customers/${encodeURIComponent(customer.id)}`, { method: 'DELETE' }),
    onSuccess() { showToast('Customer deleted fully'); void queryClient.invalidateQueries({ queryKey: ['customers'] }); void queryClient.invalidateQueries({ queryKey: ['orders'] }); void queryClient.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError(error) { showToast(error.message, 'error'); },
  });
  function deleteCustomer(customer: Customer) {
    if (!window.confirm(`Delete ${customer.name} fully?\n\nThis removes their orders, reward balances, QR links, and WhatsApp logs.`)) return;
    remove.mutate(customer);
  }
  return <>
    <PageHeader title="Customers & QR Codes" subtitle="Customer points remain separated by merchant while one QR works across the network." actions={<Link className="button primary" to="/add-customer"><Plus size={16} />Add {user.role === 'admin' ? 'customer' : 'buyer'}</Link>} />
    <div className="list-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search customers" /></label></div>
    {customers.isPending ? <LoadingState label="Loading customers" /> : customers.isError ? <ErrorState error={customers.error} retry={() => customers.refetch()} /> : <>
      <div className="customer-grid">{customers.data?.customers.map((customer, index) => <article className="customer-card" key={`${customer.databaseId}-${customer.merchantId || index}`}>
        <div className="customer-head"><span className="avatar">{initials(customer.name)}</span><div><h3>{customer.name}</h3><strong>{customer.id}</strong><p>{formatPhone(customer.phone)}</p><p>{customer.email}</p></div><button className="icon-button qr-view-button" title="View QR" onClick={() => setSelected(customer)}><Eye /></button></div>
        <div className="customer-stats"><div><strong>{customer.orderCount || 0}</strong><span>Orders</span></div><div><strong>{formatCurrency(customer.totalSpend || 0)}</strong><span>Spent</span></div><div><strong>{formatPoints(customer.totalRewardPoints ?? customer.rewardPoints)}</strong><span>{user.role === 'admin' ? 'Total points' : 'Points'}</span></div></div>
        {user.role === 'admin' && customer.memberships?.length ? <div className="membership-list">{customer.memberships.map((membership) => <div key={membership.merchantId}><span><strong>{membership.merchant}</strong><small>{membership.qrScans} scans</small></span><span className="tag violet">{formatPoints(membership.rewardPoints)} pts</span></div>)}</div> : null}
        <div className="customer-foot"><span className={`tag ${customer.isRetained ? 'success' : 'info'}`}>{customer.isRetained ? 'Returning' : 'New'}</span><div><button className="icon-button whatsapp-icon" title="Send WhatsApp QR" onClick={() => setSelected(customer)}><MessageCircle /></button><button className="icon-button" title="View QR" onClick={() => setSelected(customer)}><Eye /></button>{user.role === 'admin' ? <button className="icon-button danger-icon" title="Delete customer" disabled={remove.isPending} onClick={() => deleteCustomer(customer)}><Trash2 /></button> : null}</div></div>
      </article>)}</div>
      {!customers.data?.customers.length ? <EmptyState>No customers found.</EmptyState> : null}
      <PaginationBar pagination={customers.data?.pagination} onPage={setPage} />
    </>}
    {selected ? <CustomerQrModal customer={selected} onClose={() => setSelected(null)} /> : null}
  </>;
}
