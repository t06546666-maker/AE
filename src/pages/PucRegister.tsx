import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Phone, MessageCircle, User, Download, Plus, X,
  AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';
import { apiFetch } from '../api';
import { AddCustomer } from './AddCustomer';
import { ErrorState, LoadingState } from '../components/Common';
import type { UserProfile } from '../types';
import { formatCurrency, formatDate, formatPhone, formatPoints, initials } from '../utils';
import './puc-register.css';

type Config = { eligible: boolean; shopName?: string; earnOptions?: number[]; testAccount?: boolean };
type RecordRow = {
  id: string;
  name: string;
  phone: string;
  plate: string;
  model: string;
  amount: number;
  rate: number;
  testDate: string;
  expiryDate: string;
  status: string;
  points?: number;
  orderNo?: string;
  consent?: boolean;
};

const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const configQuery = () => ({
  queryKey: ['puc-config'],
  queryFn: ({ signal }: { signal: AbortSignal }) => apiFetch<Config>('/api/merchant/puc/config', { signal }),
  staleTime: 0,
});

export function PucCustomerEntry({ user }: { user: UserProfile }) {
  const config = useQuery(configQuery());
  if (config.isPending) return <LoadingState />;
  if (config.isError) return <ErrorState error={config.error} retry={() => config.refetch()} />;
  return config.data.eligible ? <PucRegister initialOpen /> : <AddCustomer user={user} />;
}

export function PucCustomerDirectory({ fallback }: { fallback: ReactNode }) {
  const config = useQuery(configQuery());
  if (config.isPending) return <LoadingState />;
  if (config.isError) return <ErrorState error={config.error} retry={() => config.refetch()} />;
  return config.data.eligible ? <PucRegister customersView /> : fallback;
}

export function PucRegister({ initialOpen = false, customersView = false }: { initialOpen?: boolean; customersView?: boolean }) {
  const config = useQuery(configQuery()), client = useQueryClient(), navigate = useNavigate(), [params, setParams] = useSearchParams();
  const requested = params.get('filter') || 'all';
  const filter = ['all', 'expiry', 'expired', 'due10'].includes(requested) ? requested : 'all';
  const [open, setOpen] = useState(initialOpen);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState({ key: '', cursor: '' });
  const [sending, setSending] = useState<string | null>(null);
  const [profile, setProfile] = useState<RecordRow | null>(null);

  const filterKey = filter + '|' + month;
  const after = page.key === filterKey ? page.cursor : '';
  const setAfter = (cursor: string) => setPage({ key: filterKey, cursor });

  const records = useQuery({
    queryKey: ['puc-records', filter, month, after],
    enabled: config.data?.eligible === true,
    queryFn: ({ signal }) => apiFetch<{ records: RecordRow[]; nextCursor: string | null }>(
      '/api/merchant/puc/records?' + new URLSearchParams({ filter, ...(month ? { month } : {}), ...(after ? { after } : {}) }).toString(),
      { signal }
    )
  });

  if (config.isPending) return <LoadingState />;
  if (config.isError) return <ErrorState error={config.error} retry={() => config.refetch()} />;
  if (!config.data.eligible) {
    return (
      <section className="panel">
        <h1>PUC access unavailable</h1>
        <p>This workspace is only for pollution-testing categories.</p>
        <Link to="/dashboard">Back to dashboard</Link>
      </section>
    );
  }

  const all = records.data?.records || [];
  const completed = all.filter(row => row.status === 'completed');
  const todayStr = today();
  const expiredCount = completed.filter(row => row.expiryDate < todayStr).length;
  const due10Count = completed.filter(row => {
    if (row.expiryDate < todayStr) return false;
    const diffDays = (Date.parse(row.expiryDate) - Date.parse(todayStr)) / 86400000;
    return diffDays <= 10;
  }).length;

  const filtered = all.filter(row => !search || `${row.name} ${row.phone} ${row.plate} ${row.model}`.toLowerCase().includes(search.toLowerCase()));

  const selectFilter = (value: string) => {
    setParams({ filter: value });
  };

  const close = () => {
    setOpen(false);
    if (initialOpen) navigate('/customers', { replace: true });
  };

  async function remind(id: string) {
    if (sending) return;
    setSending(id);
    try {
      const result = await apiFetch<{ message: string }>('/api/merchant/puc/records/' + encodeURIComponent(id) + '/reminder', { method: 'POST' });
      setNotice(result.message);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setSending(null);
    }
  }

  function download() {
    const quote = (s: unknown) => '"' + String(s ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
    const rows = [
      ['Customer', 'Phone', 'Vehicle', 'Model', 'Fee', 'Points', 'Test date', 'Expiry', 'Order', 'Status'],
      ...filtered.map(row => [row.name, row.phone, row.plate, row.model, row.amount, row.points, row.testDate, row.expiryDate, row.orderNo, row.status])
    ];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `PUC-register-${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="puc-unified-workspace">
      {/* Unified Standard AE Header */}
      <header className="puc-page-header">
        <div className="puc-title-group">
          <div className="puc-eyebrow-line">
            <span className="puc-eyebrow-text">AE · Vehicle Pollution Centre</span>
            {config.data.testAccount && <span className="puc-test-badge">Private Test Account</span>}
          </div>
          <h1 className="puc-page-title">Customer Vehicles</h1>
          <p className="puc-page-subtitle">Certificates, expiry tracking & WhatsApp renewal</p>
        </div>
        <button type="button" className="button primary puc-add-btn" onClick={() => setOpen(true)}>
          <Plus size={16} /> Add Customer
        </button>
      </header>

      {/* Standard AE Metric KPI Cards */}
      <section className="puc-kpi-grid">
        <button
          type="button"
          className={`puc-kpi-card ${filter === 'all' ? 'active' : ''}`}
          onClick={() => selectFilter('all')}
        >
          <span className="puc-kpi-label">Total Vehicles</span>
          <strong className="puc-kpi-value">{completed.length}</strong>
          <small className="puc-kpi-hint">Registered certificates</small>
        </button>
        <button
          type="button"
          className={`puc-kpi-card warning ${filter === 'due10' ? 'active' : ''}`}
          onClick={() => selectFilter(filter === 'due10' ? 'all' : 'due10')}
        >
          <span className="puc-kpi-label">Due in 10 Days</span>
          <strong className="puc-kpi-value">{due10Count}</strong>
          <small className="puc-kpi-hint">Upcoming renewals</small>
        </button>
        <button
          type="button"
          className={`puc-kpi-card danger ${filter === 'expired' ? 'active' : ''}`}
          onClick={() => selectFilter(filter === 'expired' ? 'all' : 'expired')}
        >
          <span className="puc-kpi-label">Overdue</span>
          <strong className="puc-kpi-value">{expiredCount}</strong>
          <small className="puc-kpi-hint">Expired certificates</small>
        </button>
      </section>

      {notice && (
        <div className="puc-notice-banner" role="status">
          <span>{notice}</span>
          <button type="button" className="puc-notice-close" onClick={() => setNotice('')}>×</button>
        </div>
      )}

      {/* Toolbar: Search, Month, Filter chips & Export */}
      <div className="puc-toolbar-wrap">
        <div className="puc-search-box">
          <Search size={16} className="puc-search-icon" />
          <input
            aria-label="Search vehicles"
            placeholder="Search customer, phone or vehicle plate..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="puc-search-clear" onClick={() => setSearch('')}>×</button>
          )}
        </div>
        <label className="puc-month-field">
          <span>Expiry Month</span>
          <input
            aria-label="Expiry month"
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button secondary puc-export-btn"
          onClick={download}
          disabled={!filtered.length}
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      <nav className="puc-filter-bar" aria-label="Filter customer vehicles">
        <button
          type="button"
          className={`puc-filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => selectFilter('all')}
        >
          All Records ({completed.length})
        </button>
        <button
          type="button"
          className={`puc-filter-chip warning ${filter === 'due10' ? 'active' : ''}`}
          onClick={() => selectFilter('due10')}
        >
          Due in 10 Days ({due10Count})
        </button>
        <button
          type="button"
          className={`puc-filter-chip danger ${filter === 'expired' ? 'active' : ''}`}
          onClick={() => selectFilter('expired')}
        >
          Overdue ({expiredCount})
        </button>
      </nav>

      {/* Main Records List */}
      {records.isPending ? (
        <LoadingState />
      ) : records.isError ? (
        <ErrorState error={records.error} retry={() => records.refetch()} />
      ) : (
        <>
          <div className="puc-card-grid">
            {filtered.map(row => {
              const isOverdue = row.status === 'completed' && row.expiryDate < todayStr;
              const daysDiff = Math.round((Date.parse(row.expiryDate) - Date.parse(todayStr)) / 86400000);
              const isDueSoon = !isOverdue && daysDiff <= 10 && daysDiff >= 0;
              const cleanPhone = row.phone.replace(/\D/g, '');
              const telLink = `tel:+${cleanPhone.length === 10 ? '91' : ''}${cleanPhone}`;

              return (
                <article
                  key={row.id}
                  className={`puc-card ${isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : ''}`}
                >
                  <div className="puc-card-top">
                    <div className="puc-user-meta">
                      <span className="puc-avatar">{initials(row.name)}</span>
                      <div>
                        <h2 className="puc-name">{row.name}</h2>
                        <a href={telLink} className="puc-phone">{formatPhone(row.phone)}</a>
                      </div>
                    </div>
                    <div className="puc-plate-wrap">
                      <span className="puc-plate-badge">{row.plate.replace(/-/g, ' ')}</span>
                    </div>
                  </div>

                  <div className="puc-vehicle-info-bar">
                    <span className="puc-model-name">{row.model}</span>
                    {isOverdue ? (
                      <span className="puc-status-tag danger">
                        <AlertTriangle size={12} /> Expired {formatDate(row.expiryDate)} · Overdue by {Math.abs(daysDiff)}d
                      </span>
                    ) : isDueSoon ? (
                      <span className="puc-status-tag warning">
                        <Clock size={12} /> Due in {daysDiff}d · {formatDate(row.expiryDate)}
                      </span>
                    ) : (
                      <span className="puc-status-tag success">
                        <CheckCircle2 size={12} /> Valid till {formatDate(row.expiryDate)}
                      </span>
                    )}
                  </div>

                  <div className="puc-record-summary">
                    <span>Service Fee: <strong>{formatCurrency(row.amount)}</strong></span>
                    <span className="puc-sep">·</span>
                    <span>Rewards: <strong className="puc-points-val">{row.status === 'completed' ? `${formatPoints(row.points || 0)} pts` : 'Pending'}</strong></span>
                    {row.orderNo && <small className="puc-order-no">{row.orderNo}</small>}
                  </div>

                  <div className="puc-action-bar">
                    <a className="button puc-btn-call" href={telLink}>
                      <Phone size={14} /> Call
                    </a>
                    <button
                      type="button"
                      className="button puc-btn-wa"
                      disabled={sending !== null || row.status !== 'completed'}
                      onClick={() => void remind(row.id)}
                    >
                      <MessageCircle size={14} /> {sending === row.id ? 'Sending…' : 'WhatsApp'}
                    </button>
                    <button
                      type="button"
                      className="button secondary puc-btn-profile"
                      onClick={() => setProfile(row)}
                    >
                      <User size={14} /> Profile
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {!filtered.length && (
            <div className="puc-empty-state">
              <p>
                {filter === 'due10'
                  ? 'No vehicles expire in the next 10 days.'
                  : filter === 'expired'
                  ? 'No overdue vehicle certificates found.'
                  : 'No customer vehicle records found.'}
              </p>
            </div>
          )}

          <div className="puc-pagination-toolbar">
            {after && (
              <button type="button" className="button secondary" onClick={() => setAfter('')}>
                First page
              </button>
            )}
            {records.data?.nextCursor && (
              <button type="button" className="button secondary" onClick={() => setAfter(records.data!.nextCursor!)}>
                Next page
              </button>
            )}
          </div>
        </>
      )}

      {/* Customer Profile Dialog */}
      {profile && (
        <div className="puc-overlay" role="presentation" onClick={e => { if (e.target === e.currentTarget) setProfile(null); }}>
          <section className="puc-dialog" role="dialog" aria-modal="true" aria-labelledby="puc-customer-profile">
            <header className="puc-dialog-header">
              <div className="puc-dialog-title-meta">
                <span className="puc-avatar">{initials(profile.name)}</span>
                <div>
                  <h2 id="puc-customer-profile">{profile.name}</h2>
                  <small>{formatPhone(profile.phone)}</small>
                </div>
              </div>
              <button type="button" className="icon-button modal-close" aria-label="Close" onClick={() => setProfile(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="puc-dialog-content">
              <div className="puc-dialog-plate-box">
                <span className="puc-plate-badge large">{profile.plate.replace(/-/g, ' ')}</span>
                <strong>{profile.model}</strong>
              </div>
              <dl className="puc-dialog-details">
                <div>
                  <dt>Last Test Date</dt>
                  <dd>{formatDate(profile.testDate)}</dd>
                </div>
                <div>
                  <dt>Certificate Expiry</dt>
                  <dd>{formatDate(profile.expiryDate)}</dd>
                </div>
                <div>
                  <dt>Service Fee</dt>
                  <dd>{formatCurrency(profile.amount)}</dd>
                </div>
                <div>
                  <dt>Points Added</dt>
                  <dd>{formatPoints(profile.points || 0)} pts</dd>
                </div>
                {profile.orderNo && (
                  <div className="full-width">
                    <dt>Order Reference</dt>
                    <dd>{profile.orderNo}</dd>
                  </div>
                )}
              </dl>
            </div>
            <footer className="puc-dialog-footer">
              <button type="button" className="button secondary" onClick={() => setProfile(null)}>
                Close
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* Add Customer Form Modal */}
      {open && (
        <PucForm
          rates={config.data.earnOptions || []}
          onClose={close}
          onSaved={row => {
            setNotice(`${row.name}: ${formatPoints(row.points || 0)} points added. Order ${row.orderNo}.`);
            void client.invalidateQueries({ queryKey: ['puc-records'] });
            void client.invalidateQueries({ queryKey: ['orders'] });
            void client.invalidateQueries({ queryKey: ['merchant-overview'] });
            close();
          }}
        />
      )}
    </main>
  );
}

function PucForm({ rates, onClose, onSaved }: { rates: number[]; onClose: () => void; onSaved: (row: RecordRow) => void }) {
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [testDate, setTestDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState('');
  const [consent, setConsent] = useState(false);

  const fee = Number(amount);
  const points = !rate || !Number.isFinite(fee) || fee < 1 ? 0 : fee < 10 ? 1 : fee < 50 ? 2 : fee < 100 ? 5 : Math.min(100, Math.round(fee * Number(rate)) / 100);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || uncertain) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiFetch<{ record: RecordRow }>('/api/merchant/puc/records', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ name, phone, plate, model, amount: fee, rate: Number(rate), testDate, expiryDate, consent })
      });
      onSaved(result.record);
    } catch (e) {
      setError((e as Error).message);
      setUncertain(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="puc-overlay" role="presentation">
      <section className="puc-dialog" role="dialog" aria-modal="true" aria-labelledby="puc-form-title">
        <header className="puc-dialog-header">
          <div>
            <h2 id="puc-form-title">Add Customer & Vehicle</h2>
            <small className="puc-dialog-sub">Register vehicle certificate and award reward points</small>
          </div>
          <button type="button" className="icon-button modal-close" aria-label="Close" disabled={busy} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <form id="puc-add-customer" className="puc-form" onSubmit={submit}>
          <fieldset disabled={busy || uncertain}>
            <label>
              <span>Customer Name</span>
              <input required maxLength={100} placeholder="e.g. Rahul Sharma" value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label>
              <span>Mobile Number</span>
              <input required type="tel" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit mobile" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} />
            </label>
            <label>
              <span>Vehicle Registration</span>
              <input required minLength={6} maxLength={20} placeholder="e.g. KL09AB1234" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} />
            </label>
            <label>
              <span>Vehicle Model</span>
              <input required maxLength={100} placeholder="e.g. Maruti Suzuki Swift" value={model} onChange={e => setModel(e.target.value)} />
            </label>
            <label>
              <span>Test Date</span>
              <input required type="date" max={today()} value={testDate} onChange={e => setTestDate(e.target.value)} />
            </label>
            <label>
              <span>Certificate Expiry</span>
              <input required type="date" min={testDate} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            </label>
            <label>
              <span>Service Fee (₹)</span>
              <input required type="number" min="1" max="1000000" step="0.01" placeholder="₹ Amount" value={amount} onChange={e => setAmount(e.target.value)} />
            </label>
            <label>
              <span>Reward Rate</span>
              <select required value={rate} onChange={e => setRate(e.target.value)}>
                <option value="">Select reward rate</option>
                {rates.map(value => (
                  <option key={value} value={value}>{value} points per ₹100</option>
                ))}
              </select>
            </label>
            <div className="puc-points-card">
              <span>Points Preview</span>
              <strong>{formatPoints(points)} points</strong>
              <small>₹1–9.99: 1 · ₹10–49.99: 2 · ₹50–99.99: 5 · ₹100+: selected rate (max 100 pts)</small>
            </div>
            <label className="puc-consent-box">
              <input required type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
              <span>Customer agrees to vehicle registration and service reminder messages.</span>
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="form-error">
              {error} {uncertain && 'Check transaction history before starting another registration.'}
            </p>
          )}
        </form>
        <footer className="puc-dialog-footer">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" form="puc-add-customer" type="submit" disabled={busy || uncertain || !rate}>
            {busy ? 'Saving…' : 'Confirm & Add Customer'}
          </button>
        </footer>
      </section>
    </div>
  );
}
