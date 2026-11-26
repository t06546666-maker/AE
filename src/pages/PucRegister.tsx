import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Phone, MessageCircle, User, Download, Plus, X,
  AlertTriangle, CheckCircle2, Clock, CalendarDays, FileSpreadsheet, ShieldAlert
} from 'lucide-react';
import { apiFetch } from '../api';
import { AddCustomer } from './AddCustomer';
import { ErrorState, LoadingState } from '../components/Common';
import type { UserProfile } from '../types';
import { formatCurrency, formatDate, formatPhone, formatPoints, initials } from '../utils';
import './puc-register.css';

type Config = { eligible: boolean; shopName?: string; earnOptions?: number[]; testAccount?: boolean };
export type RecordRow = {
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

export const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
export const configQuery = () => ({
  queryKey: ['puc-config'],
  queryFn: ({ signal }: { signal: AbortSignal }) => apiFetch<Config>('/api/merchant/puc/config', { signal }),
  staleTime: 60_000,
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

export function PucRegister({ initialOpen = false, customersView = false, embedded = false }: { initialOpen?: boolean; customersView?: boolean; embedded?: boolean }) {
  const config = useQuery(configQuery()), client = useQueryClient(), navigate = useNavigate(), [params, setParams] = useSearchParams();
  const requested = params.get('filter') || 'all';
  const filter = ['all', 'expiry', 'expired', 'due7', 'due10', 'due15', 'due30', 'due_custom'].includes(requested) ? requested : 'all';
  
  const [open, setOpen] = useState(initialOpen);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(params.get('month') || '');
  const [customDays, setCustomDays] = useState(params.get('days') || '14');
  const [appliedDays, setAppliedDays] = useState<number | null>(params.get('days') ? parseInt(params.get('days')!, 10) : null);
  const [dropdownMode, setDropdownMode] = useState<string>(
    filter === 'due_custom' ? 'custom' : month ? 'month' : filter
  );
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState({ key: '', cursor: '' });
  const [sending, setSending] = useState<string | null>(null);
  const [profile, setProfile] = useState<RecordRow | null>(null);

  const filterKey = filter + '|' + month + '|' + (appliedDays || '');
  const after = page.key === filterKey ? page.cursor : '';
  const setAfter = (cursor: string) => setPage({ key: filterKey, cursor });

  const queryParams = new URLSearchParams({
    filter,
    ...(month ? { month } : {}),
    ...(filter === 'due_custom' && appliedDays ? { days: String(appliedDays) } : {}),
    ...(after ? { after } : {})
  });

  const records = useQuery({
    queryKey: ['puc-records', filter, month, appliedDays, after],
    enabled: config.data?.eligible === true,
    queryFn: ({ signal }) => apiFetch<{ records: RecordRow[]; nextCursor: string | null }>(
      '/api/merchant/puc/records?' + queryParams.toString(),
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

  // Filter client-side by search query and custom days if active
  const filtered = all.filter(row => {
    if (search) {
      const q = search.toLowerCase();
      const match = `${row.name} ${row.phone} ${row.plate} ${row.model}`.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filter === 'due_custom' && appliedDays) {
      if (row.expiryDate < todayStr) return false;
      const diff = (Date.parse(row.expiryDate) - Date.parse(todayStr)) / 86400000;
      if (diff > appliedDays) return false;
    }
    return true;
  });

  const selectFilter = (val: string, days?: number) => {
    const next = new URLSearchParams(params);
    next.set('filter', val);
    if (days) {
      next.set('days', String(days));
      setAppliedDays(days);
    } else {
      next.delete('days');
      setAppliedDays(null);
    }
    setDropdownMode(val === 'due_custom' ? 'custom' : val);
    setParams(next, { replace: true });
  };

  const handleDropdownSelect = (mode: string) => {
    setDropdownMode(mode);
    if (mode === 'custom') {
      const days = parseInt(customDays, 10) || 14;
      selectFilter('due_custom', days);
    } else if (mode === 'month') {
      const currentMonth = todayStr.slice(0, 7);
      setMonth(currentMonth);
      const next = new URLSearchParams(params);
      next.set('month', currentMonth);
      setParams(next, { replace: true });
    } else {
      setMonth('');
      const next = new URLSearchParams(params);
      next.delete('month');
      next.delete('days');
      next.set('filter', mode);
      setParams(next, { replace: true });
    }
  };

  const applyCustomDays = () => {
    const days = parseInt(customDays, 10);
    if (!Number.isFinite(days) || days < 1) return;
    selectFilter('due_custom', days);
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

  function downloadCsv() {
    const quote = (s: unknown) => '"' + String(s ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
    const rows = [
      ['Customer', 'Phone', 'Vehicle', 'Model', 'Fee (INR)', 'Points', 'Test Date', 'Expiry Date', 'Order No', 'Status'],
      ...filtered.map(row => [row.name, row.phone, row.plate, row.model, row.amount, row.points || 0, row.testDate, row.expiryDate, row.orderNo || '', row.status])
    ];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `AE-PUC-Vehicles-${filter}-${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={embedded ? "puc-embedded-workspace" : "puc-unified-workspace"}>
      {/* Header & Primary Action */}
      <header className="puc-page-header">
        <div className="puc-title-group">
          {!embedded && (
            <div className="puc-eyebrow-line">
              <span className="puc-eyebrow-text">AE · Vehicle Pollution Centre</span>
              {config.data.testAccount && <span className="puc-test-badge">Private Test Account</span>}
            </div>
          )}
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
          className={`puc-kpi-card ${filter === 'all' && !month ? 'active' : ''}`}
          onClick={() => handleDropdownSelect('all')}
        >
          <span className="puc-kpi-label">Total Vehicles</span>
          <strong className="puc-kpi-value">{completed.length}</strong>
          <small className="puc-kpi-hint">Registered certificates</small>
        </button>
        <button
          type="button"
          className={`puc-kpi-card warning ${filter === 'due10' ? 'active' : ''}`}
          onClick={() => handleDropdownSelect(filter === 'due10' ? 'all' : 'due10')}
        >
          <span className="puc-kpi-label">Due in 10 Days</span>
          <strong className="puc-kpi-value">{due10Count}</strong>
          <small className="puc-kpi-hint">Upcoming renewals</small>
        </button>
        <button
          type="button"
          className={`puc-kpi-card danger ${filter === 'expired' ? 'active' : ''}`}
          onClick={() => handleDropdownSelect(filter === 'expired' ? 'all' : 'expired')}
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

      {/* Toolbar: Search, Renewals Dropdown, Custom Days & Export */}
      <div className="puc-toolbar-wrap">
        <div className="puc-search-box">
          <Search size={15} className="puc-search-icon" />
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

        {/* Renewals Dropdown Filter Group */}
        <div className="puc-filter-dropdown-group">
          <label className="puc-dropdown-field">
            <span>Renewals:</span>
            <select
              aria-label="Renewal filter window"
              className="puc-filter-select"
              value={dropdownMode}
              onChange={e => handleDropdownSelect(e.target.value)}
            >
              <option value="all">🚗 All Vehicles</option>
              <option value="expired">🔴 Overdue (Expired)</option>
              <option value="due7">⏳ Due in 7 Days</option>
              <option value="due10">⏳ Due in 10 Days</option>
              <option value="due15">⏳ Due in 15 Days</option>
              <option value="due30">⏳ Due in 30 Days</option>
              <option value="custom">⚙️ Custom Days Horizon...</option>
              <option value="month">📅 By Expiry Month...</option>
            </select>
          </label>

          {dropdownMode === 'custom' && (
            <div className="puc-custom-days-box">
              <input
                aria-label="Custom days horizon"
                type="number"
                min="1"
                max="365"
                placeholder="Days (e.g. 14)"
                value={customDays}
                onChange={e => setCustomDays(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyCustomDays(); }}
              />
              <button type="button" className="button primary" onClick={applyCustomDays}>
                Apply
              </button>
            </div>
          )}

          {dropdownMode === 'month' && (
            <input
              aria-label="Expiry month selector"
              type="month"
              className="puc-month-input"
              value={month}
              onChange={e => {
                setMonth(e.target.value);
                const next = new URLSearchParams(params);
                next.set('month', e.target.value);
                setParams(next, { replace: true });
              }}
            />
          )}

          <button
            type="button"
            className="button secondary puc-export-btn"
            onClick={downloadCsv}
            disabled={!filtered.length}
            title="Download CSV report"
          >
            <Download size={15} /> Export
          </button>
        </div>
      </div>

      {/* Main Records List Styled Like AE Insights */}
      {records.isPending ? (
        <LoadingState label="Loading customer vehicles…" />
      ) : records.isError ? (
        <ErrorState error={records.error} retry={() => records.refetch()} />
      ) : !filtered.length ? (
        <div className="puc-empty-state">
          <Clock size={36} className="puc-empty-icon" />
          <h3 className="puc-empty-title">
            {search ? 'No matching vehicles found' : 'No customer vehicles in this view'}
          </h3>
          <p className="puc-empty-desc">
            {search
              ? 'Try another name, phone number or vehicle registration plate.'
              : 'Add customer vehicles using the button above to start tracking certificates and automated renewals.'}
          </p>
        </div>
      ) : (
        <>
          <div className="puc-insights-list">
            {filtered.map(row => {
              const isExpired = row.expiryDate < todayStr;
              const diffDays = Math.ceil((Date.parse(row.expiryDate) - Date.parse(todayStr)) / 86400000);
              const isDueSoon = !isExpired && diffDays <= 10;
              const statusTag = isExpired ? 'danger' : isDueSoon ? 'warning' : 'valid';
              const statusText = isExpired
                ? `Expired ${Math.abs(diffDays)}d ago`
                : diffDays === 0
                ? 'Expires today'
                : diffDays <= 30
                ? `Due in ${diffDays} days`
                : `Valid till ${formatDate(row.expiryDate)}`;

              return (
                <article className="puc-insight-row" key={row.id}>
                  {/* Left: Avatar + Customer */}
                  <div
                    className="puc-insight-left"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setProfile(row)}
                  >
                    <span className="puc-avatar">{initials(row.name)}</span>
                    <div className="puc-customer-info">
                      <h3 className="puc-customer-name">{row.name}</h3>
                      <p className="puc-customer-phone">{formatPhone(row.phone)}</p>
                    </div>
                  </div>

                  {/* Center: Vehicle Plate & Model */}
                  <div
                    className="puc-insight-vehicle"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setProfile(row)}
                  >
                    <span className="puc-plate-badge">{row.plate.replace(/-/g, ' ')}</span>
                    <span className="puc-model-name">{row.model}</span>
                  </div>

                  {/* Bottom Row on Mobile / Right Row on Desktop */}
                  <div className="puc-insight-bottom-row">
                    <div className="puc-insight-status">
                      <span className={`puc-tag ${statusTag}`}>{statusText}</span>
                      <span className="puc-expiry-sub">Expiry: {row.expiryDate}</span>
                    </div>

                    <div className="puc-insight-actions">
                      <a
                        href={`https://wa.me/${row.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Hello ${row.name}, your vehicle (${row.plate}) pollution certificate renewal is due (${row.expiryDate}). Visit our center to renew and earn reward points.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="puc-action-btn whatsapp"
                        title="Send WhatsApp renewal message"
                        onClick={e => {
                          e.stopPropagation();
                          void remind(row.id);
                        }}
                      >
                        <MessageCircle size={15} />
                      </a>
                      <a
                        href={`tel:${row.phone}`}
                        className="puc-action-btn call"
                        title={`Call ${row.name}`}
                        onClick={e => e.stopPropagation()}
                      >
                        <Phone size={15} />
                      </a>
                      <button
                        type="button"
                        className="puc-action-btn"
                        title="View certificate details"
                        onClick={() => setProfile(row)}
                      >
                        <User size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="puc-pagination-wrap">
            {records.data?.nextCursor && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setAfter(records.data!.nextCursor!)}
              >
                Next page
              </button>
            )}
          </div>
        </>
      )}

      {/* Customer Profile Details Dialog */}
      {profile && (
        <div
          className="puc-overlay"
          role="presentation"
          onClick={e => {
            if (e.target === e.currentTarget) setProfile(null);
          }}
        >
          <section className="puc-dialog" role="dialog" aria-modal="true" aria-labelledby="puc-customer-profile">
            <header className="puc-dialog-header">
              <div className="puc-dialog-title-meta">
                <span className="puc-avatar">{initials(profile.name)}</span>
                <div>
                  <h2 id="puc-customer-profile">{profile.name}</h2>
                  <small className="puc-dialog-sub">{formatPhone(profile.phone)}</small>
                </div>
              </div>
              <button
                type="button"
                className="icon-button modal-close"
                aria-label="Close"
                onClick={() => setProfile(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="puc-dialog-content">
              <div className="puc-dialog-plate-box">
                <span className="puc-plate-badge">{profile.plate.replace(/-/g, ' ')}</span>
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

      {/* Compact Add Customer & Vehicle Modal */}
      {open && (
        <PucForm
          rates={config.data.earnOptions || []}
          onClose={close}
          onSaved={row => {
            setNotice(`${row.name}: ${formatPoints(row.points || 0)} points added. Order ${row.orderNo || ''}.`);
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

// Compact, Mobile-Optimized Add Customer Form
function PucForm({
  rates,
  onClose,
  onSaved
}: {
  rates: number[];
  onClose: () => void;
  onSaved: (row: RecordRow) => void;
}) {
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
  const points =
    !rate || !Number.isFinite(fee) || fee < 1
      ? 0
      : fee < 10
      ? 1
      : fee < 50
      ? 2
      : fee < 100
      ? 5
      : Math.min(100, Math.round(fee * Number(rate)) / 100);

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
              <span>Vehicle Plate</span>
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
                <option value="">Select rate</option>
                {rates.map(value => (
                  <option key={value} value={value}>{value} pts per ₹100</option>
                ))}
              </select>
            </label>
            <div className="puc-points-card">
              <span>Points Preview</span>
              <strong>{formatPoints(points)} points</strong>
              <small>₹1–9.99: 1 · ₹10–49.99: 2 · ₹50–99.99: 5 · ₹100+: selected rate (max 100)</small>
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

// Dedicated PUC Reports Component for the Reports Tab in MerchantOverview
export function PucReportsView({ month }: { month: string }) {
  const records = useQuery({
    queryKey: ['puc-records', 'all', '', null, ''],
    queryFn: ({ signal }) => apiFetch<{ records: RecordRow[] }>('/api/merchant/puc/records?filter=all', { signal })
  });

  const all = records.data?.records || [];
  const todayStr = today();

  function exportRegister() {
    const quote = (s: unknown) => '"' + String(s ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
    const rows = [
      ['Customer Name', 'Mobile Number', 'Vehicle Plate', 'Vehicle Model', 'Service Fee (INR)', 'Reward Points', 'Test Date', 'Expiry Date', 'Order No', 'Status'],
      ...all.map(r => [r.name, r.phone, r.plate, r.model, r.amount, r.points || 0, r.testDate, r.expiryDate, r.orderNo || '', r.status])
    ];
    downloadCsvBlob(rows, `AE-PUC-All-Vehicles-${todayStr}.csv`);
  }

  function exportRenewals() {
    const quote = (s: unknown) => '"' + String(s ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
    const expiring = all.filter(r => {
      const diff = (Date.parse(r.expiryDate) - Date.parse(todayStr)) / 86400000;
      return diff <= 30; // overdue or due within 30 days
    });
    const rows = [
      ['Customer Name', 'Mobile Number', 'Vehicle Plate', 'Vehicle Model', 'Expiry Date', 'Status', 'Days Relative'],
      ...expiring.map(r => {
        const diff = Math.ceil((Date.parse(r.expiryDate) - Date.parse(todayStr)) / 86400000);
        const status = diff < 0 ? 'OVERDUE' : diff <= 10 ? 'DUE SOON' : 'UPCOMING';
        return [r.name, r.phone, r.plate, r.model, r.expiryDate, status, diff < 0 ? `${Math.abs(diff)} days ago` : `in ${diff} days`];
      })
    ];
    downloadCsvBlob(rows, `AE-PUC-Renewals-Outreach-${todayStr}.csv`);
  }

  function exportMonthlySummary() {
    const monthlyRecords = all.filter(r => r.testDate.startsWith(month));
    const totalFees = monthlyRecords.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const totalPoints = monthlyRecords.reduce((acc, r) => acc + (Number(r.points) || 0), 0);
    const rows = [
      ['Reporting Month', 'Total Vehicle Tests', 'Total Service Revenue (INR)', 'Total Reward Points Issued'],
      [month, monthlyRecords.length, totalFees, totalPoints]
    ];
    downloadCsvBlob(rows, `AE-PUC-Monthly-Summary-${month}.csv`);
  }

  function downloadCsvBlob(rows: (string | number)[][], filename: string) {
    const quote = (s: unknown) => '"' + String(s ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
    const csv = '\uFEFF' + rows.map(r => r.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mo-panel puc-reports-panel">
      <div>
        <h2>PUC Vehicle Reports & Registers</h2>
        <p className="mo-subtitle">Download official CSV registers for vehicle pollution tests, expiry tracking, and monthly audits.</p>
      </div>

      <div className="mo-report-list">
        <button type="button" onClick={exportRegister}>
          <span className="mo-icon blue">
            <FileSpreadsheet size={22} />
          </span>
          <span>
            <strong>Complete Vehicle Pollution Register</strong>
            <small>All registered customer vehicles, test records, fees, and points (Lifetime)</small>
          </span>
          <Download size={19} />
        </button>

        <button type="button" onClick={exportRenewals}>
          <span className="mo-icon amber">
            <ShieldAlert size={22} />
          </span>
          <span>
            <strong>Upcoming Expiry & Overdue Renewals</strong>
            <small>Customers due for certificate renewal within 30 days or overdue (includes mobile numbers)</small>
          </span>
          <Download size={19} />
        </button>

        <button type="button" onClick={exportMonthlySummary}>
          <span className="mo-icon green">
            <CalendarDays size={22} />
          </span>
          <span>
            <strong>Monthly PUC Summary & Fee Audit ({month})</strong>
            <small>Total tests conducted, service fee revenue, and reward points issued for {month}</small>
          </span>
          <Download size={19} />
        </button>
      </div>
    </section>
  );
}
