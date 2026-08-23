import { useDeferredValue, useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Download, Eye, KeyRound, Plus, Search, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { EmptyState, ErrorState, ExportModal, LoadingState, PageHeader, PaginationBar } from '../components/Common';
import type { Merchant, MerchantSummaryResponse, Pagination } from '../types';
import { formatDate, formatPoints } from '../utils';
import { useToast } from '../toast';

interface CredentialResult {
  merchantCode: string;
  loginEmail: string;
  temporaryPassword: string;
  whatsapp: { sent: boolean; status: string; error: string | null };
}

interface CreateMerchantResponse {
  merchant: Merchant;
  temporaryPassword: string;
  whatsapp: CredentialResult['whatsapp'];
}

export function Merchants() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const [credentials, setCredentials] = useState<CredentialResult | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  useEffect(() => setPage(1), [deferredSearch]);

  const networksQuery = useQuery({
    queryKey: ['networks'],
    queryFn: ({ signal }) => apiFetch<{ networks: { id: string; code: string; name: string }[] }>('/api/networks', { signal }),
  });

  useEffect(() => {
    if (networksQuery.data?.networks?.length && !networkId) {
      setNetworkId(networksQuery.data.networks[0].id);
    }
  }, [networksQuery.data, networkId]);

  const merchants = useQuery({
    queryKey: ['merchants', page, deferredSearch],
    queryFn: ({ signal }) => apiFetch<{ merchants: Merchant[]; pagination: Pagination }>(`/api/merchants?${queryString({
      page,
      pageSize: 20,
      search: deferredSearch,
    })}`, { signal }),
    placeholderData: (previous) => previous,
  });

  const create = useMutation({
    mutationFn: () => apiFetch<CreateMerchantResponse>('/api/merchants', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), password, network_id: networkId }),
    }),
    onSuccess(data) {
      setCredentials({
        merchantCode: data.merchant.merchantCode,
        loginEmail: data.merchant.email,
        temporaryPassword: data.temporaryPassword,
        whatsapp: data.whatsapp,
      });
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      showToast(t('merchants.created'));
      void queryClient.invalidateQueries({ queryKey: ['merchants'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  const reset = useMutation({
    mutationFn: (merchant: Merchant) => apiFetch<CredentialResult>(
      `/api/merchants/${encodeURIComponent(merchant.id)}/reset-password`,
      { method: 'POST' },
    ),
    onSuccess(data) {
      setCredentials(data);
      showToast(t('merchants.resetDone'));
      void queryClient.invalidateQueries({ queryKey: ['merchants'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  const remove = useMutation({
    mutationFn: (merchant: Merchant) => apiFetch<{ deletedCustomers?: number }>(
      `/api/merchants/${encodeURIComponent(merchant.id)}`,
      { method: 'DELETE' },
    ),
    onSuccess(data) {
      showToast(data.deletedCustomers
        ? `Merchant removed · ${data.deletedCustomers} customer records removed`
        : 'Merchant removed');
      void queryClient.invalidateQueries({ queryKey: ['merchants'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  function deleteMerchant(merchant: Merchant) {
    if (window.confirm(`Delete ${merchant.name} fully?\n\nThis removes the merchant login, orders, links, and customers that belong only to this merchant.`)) {
      remove.mutate(merchant);
    }
  }

  function resetMerchant(merchant: Merchant) {
    if (window.confirm(`${t('merchants.resetConfirm')}\n\n${merchant.name} · ${merchant.merchantCode}`)) {
      reset.mutate(merchant);
    }
  }

  return (
    <>
      <PageHeader title={t('merchants.title')} subtitle={t('merchants.subtitle')} actions={<><button type="button" className="button secondary" onClick={() => setExportFormat('xlsx')}><Download size={16} />{t('dashboard.excel')}</button><button type="button" className="button secondary" onClick={() => setExportFormat('pdf')}><Download size={16} />{t('dashboard.pdf')}</button></>} />
      <form className="panel merchant-form" onSubmit={submit}>
        <div className="panel-heading">
          <div><h2>{t('merchants.add')}</h2><p>{t('merchants.createSecure')}</p></div>
          <Plus />
        </div>
        <div className="four-column-form">
          <label>{t('merchants.storeName')}<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>{t('login.email')}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>{t('merchants.phone')}<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
          <label>
            {t('merchants.tempPassword')}
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required />
            <small>{t('merchants.passwordHelp')}</small>
          </label>
          {networksQuery.data?.networks && networksQuery.data.networks.length > 0 && (
            <label>
              Location / Network
              <select value={networkId} onChange={(e) => setNetworkId(e.target.value)} required>
                {networksQuery.data.networks.map(n => (
                  <option key={n.id} value={n.id}>{n.code} - {n.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button className="button primary" disabled={create.isPending}>
          <Plus size={16} />{create.isPending ? t('merchants.creating') : t('merchants.add')}
        </button>
      </form>

      <div className="list-toolbar">
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t('common.search')} /></label>
      </div>

      {merchants.isPending ? <LoadingState label={t('common.loading')} /> : merchants.isError ? (
        <ErrorState error={merchants.error} retry={() => merchants.refetch()} />
      ) : (
        <section className="table-panel">
          <div className="table-scroll">
            <table>
              <thead><tr><th>{t('merchants.code')}</th><th>{t('merchants.storeName')}</th><th>{t('login.email')}</th><th>{t('merchants.phone')}</th><th>{t('merchants.joined')}</th><th>{t('dashboard.orders')}</th><th>{t('merchants.actions')}</th></tr></thead>
              <tbody>
                {merchants.data?.merchants.map((merchant) => (
                  <tr key={merchant.id}>
                    <td><strong>{merchant.merchantCode}</strong>{merchant.mustChangePassword ? <small className="table-note">Password change required</small> : null}</td>
                    <td><strong>{merchant.name}</strong></td>
                    <td>{merchant.email}</td>
                    <td>{merchant.phone}</td>
                    <td>{formatDate(merchant.joined)}</td>
                    <td>{merchant.orderCount ?? 0}</td>
                    <td>
                      <div className="table-actions">
                        <Link className="icon-button" title="View merchant" to={`/merchants/${merchant.id}`}><Eye /></Link>
                        <button className="icon-button" title={t('merchants.reset')} disabled={reset.isPending} onClick={() => resetMerchant(merchant)}><KeyRound /></button>
                        <button className="icon-button danger-icon" title="Delete merchant" disabled={remove.isPending} onClick={() => deleteMerchant(merchant)}><Trash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!merchants.data?.merchants.length ? <EmptyState>No merchants found.</EmptyState> : null}
          <PaginationBar pagination={merchants.data?.pagination} onPage={setPage} />
        </section>
      )}

      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
      <ExportModal open={Boolean(exportFormat)} format={exportFormat || 'xlsx'} isAdmin defaultSection="merchants" fixedSection onClose={() => setExportFormat(null)} />
    </>
  );
}

export function MerchantProfile() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const [credentials, setCredentials] = useState<CredentialResult | null>(null);
  const summary = useQuery({
    queryKey: ['merchant-summary', id],
    queryFn: ({ signal }) => apiFetch<MerchantSummaryResponse>(`/api/merchants/${encodeURIComponent(id)}/summary`, { signal }),
    enabled: Boolean(id),
  });
  const reset = useMutation({
    mutationFn: () => apiFetch<CredentialResult>(`/api/merchants/${encodeURIComponent(id)}/reset-password`, { method: 'POST' }),
    onSuccess(data) { setCredentials(data); showToast(t('merchants.resetDone')); },
    onError(error) { showToast(error.message, 'error'); },
  });

  if (summary.isPending) return <LoadingState label="Loading merchant profile" />;
  if (summary.isError) return <ErrorState error={summary.error} retry={() => summary.refetch()} />;
  const data = summary.data!;
  const stats = data.summary;

  return (
    <>
      <PageHeader
        title={data.merchant.name}
        subtitle={`${data.merchant.merchantCode} · ${data.merchant.email} · ${data.merchant.phone} · ${t('merchants.joined')} ${formatDate(data.merchant.joined)}`}
        actions={(
          <>
            <button className="button secondary" onClick={() => {
              if (window.confirm(t('merchants.resetConfirm'))) reset.mutate();
            }}><KeyRound size={16} />{t('merchants.reset')}</button>
            <button className="button secondary" onClick={() => setExportFormat('xlsx')}><Download size={16} />Excel</button>
            <button className="button secondary" onClick={() => setExportFormat('pdf')}><Download size={16} />PDF</button>
            <button className="button secondary" onClick={() => navigate('/merchants')}><ArrowLeft size={16} />Back</button>
          </>
        )}
      />
      <div className="metric-grid merchant-metrics">
        <article className="metric-card violet"><div><span>Total orders</span><strong>{stats.totalOrders}</strong><small>All time</small></div></article>
        <article className="metric-card blue"><div><span>Points issued</span><strong>{formatPoints(stats.pointsIssued)}</strong><small>From orders</small></div></article>
        <article className="metric-card pink"><div><span>Customers</span><strong>{stats.totalCustomers}</strong><small>Linked to this merchant</small></div></article>
        <article className="metric-card green"><div><span>Retention</span><strong>{stats.retainedCustomers}</strong><small>{stats.retentionRate}% retained</small></div></article>
      </div>
      <section className="panel">
        <div className="panel-heading"><div><h2>Merchant customers</h2><p>Orders, points, and retention for this store only.</p></div></div>
        <div className="profile-customer-list">
          {data.customers.map((customer) => (
            <div className="profile-customer" key={customer.databaseId}>
              <div><strong>{customer.name}</strong><small>{customer.id} · {formatPhoneSafe(customer.phone)}</small></div>
              <span><small>Orders</small><strong>{customer.orderCount || 0}</strong></span>
              <span><small>Balance</small><strong className="points-text">{formatPoints(customer.rewardPoints)} pts</strong></span>
              <span className={`tag ${customer.isRetained ? 'success' : 'info'}`}>{customer.isRetained ? 'Returning' : 'New'}</span>
            </div>
          ))}
        </div>
        {!data.customers.length ? <EmptyState>No customers linked to this merchant.</EmptyState> : null}
      </section>
      <ExportModal open={Boolean(exportFormat)} format={exportFormat || 'xlsx'} merchantId={id} isAdmin onClose={() => setExportFormat(null)} />
      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}

function CredentialsModal({ credentials, onClose }: { credentials: CredentialResult | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  if (!credentials) return null;
  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    showToast('Copied');
  }
  return (
    <div className="modal-backdrop">
      <div className="modal credentials-modal">
        <button className="icon-button modal-close" title={t('common.close')} onClick={onClose}><X /></button>
        <h2>{t('merchants.credentials')}</h2>
        <p className={credentials.whatsapp.sent ? 'credential-delivery success' : 'credential-delivery error'}>
          {t(credentials.whatsapp.sent ? 'merchants.messageSent' : 'merchants.messageFailed')}
        </p>
        {credentials.whatsapp.error ? <small className="form-error">{credentials.whatsapp.error}</small> : null}
        <div className="credential-row"><span>{t('merchants.code')}</span><strong>{credentials.merchantCode}</strong><button className="icon-button" title="Copy" onClick={() => void copy(credentials.merchantCode)}><Copy /></button></div>
        <div className="credential-row"><span>{t('merchants.loginEmail')}</span><strong>{credentials.loginEmail}</strong><button className="icon-button" title="Copy" onClick={() => void copy(credentials.loginEmail)}><Copy /></button></div>
        <div className="credential-row sensitive"><span>{t('merchants.oneTimePassword')}</span><strong>{credentials.temporaryPassword}</strong><button className="icon-button" title="Copy" onClick={() => void copy(credentials.temporaryPassword)}><Copy /></button></div>
        <button className="button primary" onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  );
}

function formatPhoneSafe(value: string) {
  const digits = String(value || '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : value;
}
