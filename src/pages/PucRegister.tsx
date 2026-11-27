import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  Search, Phone, MessageCircle, User, Download, Plus, X,
  AlertTriangle, CheckCircle2, Clock, CalendarDays, FileSpreadsheet, ShieldAlert, Loader2, Bell
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

export function computePucExpiry(baseDateStr: string, option: string, yearsNum = 1, directCustomDate = ''): string {
  if (option === 'custom_date') {
    return directCustomDate || baseDateStr || today();
  }
  const [y, m, d] = (baseDateStr || today()).split('-').map(Number);
  if (!y || !m || !d) return baseDateStr || today();

  let totalMonths = 6;
  if (option.endsWith('_months')) {
    totalMonths = parseInt(option, 10);
  } else if (option === '2_years') {
    totalMonths = 24;
  } else if (option === '3_years') {
    totalMonths = 36;
  } else if (option === 'custom_years') {
    totalMonths = Math.max(1, Math.min(20, Math.floor(Number(yearsNum) || 1))) * 12;
  }

  const targetDate = new Date(Date.UTC(y, m - 1 + totalMonths, d));
  return targetDate.toISOString().slice(0, 10);
}

async function downloadPucCsv(filename: string, rows: (string | number)[][], onStatus?: (msg: string) => void) {
  const quote = (s: unknown) => '"' + String(s ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
  const csv = '\uFEFF' + rows.map(r => r.map(quote).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });

  if (Capacitor.isNativePlatform()) {
    try {
      const saved = await Filesystem.writeFile({
        path: filename,
        data: csv,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true
      });
      await Share.share({
        title: 'PUC Report',
        text: 'PUC Vehicle Report',
        url: saved.uri,
        dialogTitle: 'Save or share PUC report'
      });
      onStatus?.('Report saved to Documents and ready to share.');
      return;
    } catch {
      onStatus?.('Unable to open share sheet. Please try again.');
      return;
    }
  }

  try {
    const file = new File([blob], filename, { type: 'text/csv' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title: 'PUC Report', text: 'PUC Vehicle Report', files: [file] });
      onStatus?.('Report ready to share or save.');
      return;
    }
  } catch {
    // Fall back to web download
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  onStatus?.('Report download started.');
}
export const configQuery = () => ({
  queryKey: ['puc-config'],
  queryFn: ({ signal }: { signal: AbortSignal }) => apiFetch<Config>('/api/merchant/puc/config', { signal }),
  staleTime: 60_000,
});

export function PucCustomerEntry({ user, fallback }: { user: UserProfile; fallback?: ReactNode }) {
  const config = useQuery(configQuery());
  if (config.isPending) return <LoadingState />;
  if (config.isError) return <ErrorState error={config.error} retry={() => config.refetch()} />;
  return config.data.eligible ? (fallback || <PucRegister initialOpen />) : <AddCustomer user={user} />;
}

export function PucCustomerDirectory({ fallback }: { fallback: ReactNode }) {
  return fallback;
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSending, setBatchSending] = useState<'whatsapp' | 'push' | null>(null);

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
    if (initialOpen) navigate(-1);
  };

  async function remind(id: string, channel: 'whatsapp' | 'push' = 'whatsapp') {
    const key = `${id}:${channel}`;
    if (sending) return;
    setSending(key);
    try {
      const result = await apiFetch<{ message: string }>(
        '/api/merchant/puc/records/' + encodeURIComponent(id) + '/reminder',
        {
          method: 'POST',
          body: JSON.stringify({ channel })
        }
      );
      setNotice(result.message);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setSending(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (filtered.length > 0 && selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  }

  async function sendBatchReminders(channel: 'whatsapp' | 'push') {
    if (batchSending || selectedIds.size === 0) return;
    setBatchSending(channel);
    try {
      const result = await apiFetch<{ message: string; processed: number; whatsappAccepted: number; pushAccepted: number }>(
        '/api/merchant/puc/records/batch-reminders',
        {
          method: 'POST',
          body: JSON.stringify({ ids: Array.from(selectedIds), channel })
        }
      );
      setNotice(result.message || `Sent reminders to ${result.processed} customer(s).`);
      setSelectedIds(new Set());
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBatchSending(null);
    }
  }

  function downloadCsv() {
    const rows = [
      ['Customer', 'Phone', 'Vehicle', 'Model', 'Fee (INR)', 'Points', 'Test Date', 'Expiry Date', 'Order No', 'Status'],
      ...filtered.map(row => [row.name, row.phone, row.plate, row.model, row.amount, row.points || 0, row.testDate, row.expiryDate, row.orderNo || '', row.status])
    ];
    void downloadPucCsv(`AE-PUC-Vehicles-${filter}-${todayStr}.csv`, rows, setNotice);
  }

  return (
    <main className={embedded ? "puc-embedded-workspace" : "puc-unified-workspace"}>
      {/* Header & Primary Action */}
      {embedded ? (
        <div className="puc-embedded-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--mo-blue, #3158f5)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Vehicle Pollution Centre
              </span>
              {config.data.testAccount && <span className="puc-test-badge">Private Test Account</span>}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 850, margin: '1px 0 0', color: 'var(--text)' }}>
              Vehicle Certificates & Renewals <span className="mo-count">{completed.length}</span>
            </h2>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              Certificates, expiry tracking & automated WhatsApp renewal reminders
            </p>
          </div>
        </div>
      ) : (
        <header className="puc-page-header">
          <div className="puc-title-group">
            <div className="puc-eyebrow-line">
              <span className="puc-eyebrow-text">AE · Vehicle Pollution Centre</span>
              {config.data.testAccount && <span className="puc-test-badge">Private Test Account</span>}
            </div>
            <h1 className="puc-page-title">Customer Vehicles</h1>
            <p className="puc-page-subtitle">Certificates, expiry tracking & WhatsApp renewal</p>
          </div>
          <button type="button" className="button primary puc-add-btn" onClick={() => setOpen(true)} style={{ background: '#059669', borderColor: '#059669' }}>
            <Plus size={15} /> Add Customer
          </button>
        </header>
      )}

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

      {/* Toolbar: Search (Line 1) + Single Aligned Filter Row (Line 2) */}
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

        <div className="puc-filter-row">
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
            <option value="month">📅 By Expiry Month...</option>
            <option value="custom">⚙️ Custom Days Horizon...</option>
          </select>

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

          {dropdownMode === 'custom' && (
            <div className="puc-custom-days-box">
              <input
                aria-label="Custom days horizon"
                type="number"
                min="1"
                max="365"
                placeholder="Days"
                value={customDays}
                onChange={e => setCustomDays(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyCustomDays(); }}
              />
              <button type="button" className="button primary" onClick={applyCustomDays}>
                Apply
              </button>
            </div>
          )}

          <button
            type="button"
            className="button secondary puc-export-btn"
            onClick={downloadCsv}
            disabled={!filtered.length}
            title="Download CSV report"
          >
            <Download size={14} /> <span>Export</span>
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
          {/* Batch Selection Toolbar */}
          <div className="puc-selection-bar">
            <label className="puc-select-all-label">
              <input
                type="checkbox"
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={toggleSelectAll}
              />
              <span>Select All ({filtered.length})</span>
            </label>
            {selectedIds.size > 0 && (
              <div className="puc-selection-actions">
                <span className="puc-selected-count">{selectedIds.size} selected</span>
                <div className="puc-batch-btn-group">
                  <button
                    type="button"
                    disabled={Boolean(batchSending)}
                    className="puc-batch-btn puc-batch-wa-btn"
                    onClick={() => sendBatchReminders('whatsapp')}
                    title="Send WhatsApp renewal reminders to selected customers"
                  >
                    {batchSending === 'whatsapp' ? (
                      <Loader2 size={13} style={{ animation: 'puc-spin 1s linear infinite' }} />
                    ) : (
                      <MessageCircle size={13} />
                    )}
                    <span>WhatsApp ({selectedIds.size})</span>
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(batchSending)}
                    className="puc-batch-btn puc-batch-push-btn"
                    onClick={() => sendBatchReminders('push')}
                    title="Send App Push notifications to selected customers"
                  >
                    {batchSending === 'push' ? (
                      <Loader2 size={13} style={{ animation: 'puc-spin 1s linear infinite' }} />
                    ) : (
                      <Bell size={13} />
                    )}
                    <span>App Notice ({selectedIds.size})</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="puc-insights-list">
            {filtered.map(row => {
              const isExpired = row.expiryDate < todayStr;
              const diffDays = Math.ceil((Date.parse(row.expiryDate) - Date.parse(todayStr)) / 86400000);
              const isDueSoon = !isExpired && diffDays <= 10;
              const statusTag = isExpired ? 'danger' : isDueSoon ? 'warning' : 'valid';
              const cardStatusClass = isExpired ? 'puc-card-expired' : isDueSoon ? 'puc-card-due-soon' : 'puc-card-valid';
              const statusText = isExpired
                ? `Expired ${Math.abs(diffDays)}d ago`
                : diffDays === 0
                  ? 'Expires today'
                  : diffDays <= 30
                    ? `Due in ${diffDays} days`
                    : 'Valid';

              return (
                <article className={`puc-insight-row puc-card-clustered ${cardStatusClass}`} key={row.id}>
                  {/* Top Row: Checkbox + Customer info on left, Action buttons on right */}
                  <div className="puc-card-top-row">
                    <div className="puc-insight-left">
                      <label className="puc-card-checkbox" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelect(row.id)}
                          aria-label={`Select ${row.name}`}
                        />
                      </label>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, cursor: 'pointer' }}
                        onClick={() => setProfile(row)}
                      >
                        <span className="puc-avatar">{initials(row.name)}</span>
                        <div className="puc-customer-info">
                          <h3 className="puc-customer-name">{row.name}</h3>
                          <p className="puc-customer-phone">
                            {formatPhone(row.phone)}
                            {row.model ? ` · ${row.model}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="puc-insight-actions">
                      <button
                        type="button"
                        disabled={sending === `${row.id}:whatsapp` || sending === `${row.id}:push`}
                        className="puc-action-btn whatsapp"
                        title="Send WhatsApp renewal message"
                        onClick={e => {
                          e.stopPropagation();
                          void remind(row.id, 'whatsapp');
                        }}
                      >
                        {sending === `${row.id}:whatsapp` ? (
                          <Loader2 size={15} style={{ animation: 'puc-spin 1s linear infinite' }} />
                        ) : (
                          <MessageCircle size={15} />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={sending === `${row.id}:whatsapp` || sending === `${row.id}:push`}
                        className="puc-action-btn push"
                        title="Send App Push notification"
                        onClick={e => {
                          e.stopPropagation();
                          void remind(row.id, 'push');
                        }}
                      >
                        {sending === `${row.id}:push` ? (
                          <Loader2 size={15} style={{ animation: 'puc-spin 1s linear infinite' }} />
                        ) : (
                          <Bell size={15} />
                        )}
                      </button>
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

                  {/* Card divider */}
                  <div className="puc-card-divider" />

                  {/* Bottom Row: Vehicle Plate on left, Status Tag + Expiry Date on right with generous gap */}
                  <div
                    className="puc-card-bottom-row"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setProfile(row)}
                  >
                    <div className="puc-insight-vehicle">
                      <span className="puc-plate-badge">{row.plate.replace(/-/g, ' ')}</span>
                    </div>

                    <div className="puc-insight-status">
                      <span className={`puc-tag ${statusTag}`}>{statusText}</span>
                      <span className="puc-expiry-sub">{formatDate(row.expiryDate)}</span>
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
                className="puc-modal-close-btn"
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
            <footer className="puc-dialog-footer" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={sending === `${profile.id}:whatsapp`}
                className="button primary"
                style={{ background: '#25d366', borderColor: '#25d366', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  void remind(profile.id, 'whatsapp');
                  setProfile(null);
                }}
              >
                {sending === `${profile.id}:whatsapp` ? <Loader2 size={16} style={{ animation: 'puc-spin 1s linear infinite' }} /> : <MessageCircle size={16} />}
                Send WhatsApp
              </button>
              <button
                type="button"
                disabled={sending === `${profile.id}:push`}
                className="button primary"
                style={{ background: '#2563eb', borderColor: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  void remind(profile.id, 'push');
                  setProfile(null);
                }}
              >
                {sending === `${profile.id}:push` ? <Loader2 size={16} style={{ animation: 'puc-spin 1s linear infinite' }} /> : <Bell size={16} />}
                Send App Notification
              </button>
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
export function PucForm({
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
  const [validityOption, setValidityOption] = useState('6_months');
  const [customYears, setCustomYears] = useState('1');
  const [customDate, setCustomDate] = useState('');
  const [expiryDate, setExpiryDate] = useState(() => computePucExpiry(today(), '6_months'));
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const nextExpiry = computePucExpiry(testDate, validityOption, Number(customYears), customDate);
    setExpiryDate(nextExpiry);
  }, [testDate, validityOption, customYears, customDate]);

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
          <button type="button" className="puc-modal-close-btn" aria-label="Close" disabled={busy} onClick={onClose}>
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
              <span>Certificate Validity</span>
              <select value={validityOption} onChange={e => setValidityOption(e.target.value)}>
                <option value="1_months">1 Month</option>
                <option value="2_months">2 Months</option>
                <option value="3_months">3 Months</option>
                <option value="4_months">4 Months</option>
                <option value="5_months">5 Months</option>
                <option value="6_months">6 Months (Standard)</option>
                <option value="7_months">7 Months</option>
                <option value="8_months">8 Months</option>
                <option value="9_months">9 Months</option>
                <option value="10_months">10 Months</option>
                <option value="11_months">11 Months</option>
                <option value="12_months">12 Months (1 Year)</option>
                <option value="2_years">2 Years</option>
                <option value="3_years">3 Years</option>
                <option value="custom_years">Custom Years...</option>
                <option value="custom_date">Custom Specific Date...</option>
              </select>
            </label>

            {validityOption === 'custom_years' && (
              <label>
                <span>Validity Duration (Years)</span>
                <input
                  type="number"
                  min="1"
                  max="15"
                  step="1"
                  required
                  placeholder="e.g. 4 or 5"
                  value={customYears}
                  onChange={e => setCustomYears(e.target.value)}
                />
              </label>
            )}

            {validityOption === 'custom_date' && (
              <label>
                <span>Specific Expiry Date</span>
                <input
                  type="date"
                  min={testDate}
                  required
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                />
              </label>
            )}

            <div className="puc-expiry-preview-badge">
              <span>Calculated Expiry Date:</span>
              <strong>{expiryDate ? formatDate(expiryDate) : 'Select duration'} ({expiryDate})</strong>
            </div>
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

  const [reportNotice, setReportNotice] = useState('');
  const all = records.data?.records || [];
  const todayStr = today();

  function exportRegister() {
    const rows = [
      ['Customer Name', 'Mobile Number', 'Vehicle Plate', 'Vehicle Model', 'Service Fee (INR)', 'Reward Points', 'Test Date', 'Expiry Date', 'Order No', 'Status'],
      ...all.map(r => [r.name, r.phone, r.plate, r.model, r.amount, r.points || 0, r.testDate, r.expiryDate, r.orderNo || '', r.status])
    ];
    void downloadPucCsv(`AE-PUC-All-Vehicles-${todayStr}.csv`, rows, setReportNotice);
  }

  function exportRenewals() {
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
    void downloadPucCsv(`AE-PUC-Renewals-Outreach-${todayStr}.csv`, rows, setReportNotice);
  }

  function exportMonthlySummary() {
    const monthlyRecords = all.filter(r => r.testDate.startsWith(month));
    const totalFees = monthlyRecords.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const totalPoints = monthlyRecords.reduce((acc, r) => acc + (Number(r.points) || 0), 0);
    const rows = [
      ['Reporting Month', 'Total Vehicle Tests', 'Total Service Revenue (INR)', 'Total Reward Points Issued'],
      [month, monthlyRecords.length, totalFees, totalPoints]
    ];
    void downloadPucCsv(`AE-PUC-Monthly-Summary-${month}.csv`, rows, setReportNotice);
  }

  return (
    <section className="mo-panel puc-reports-panel">
      <div>
        <h2>PUC Vehicle Reports & Registers</h2>
        <p className="mo-subtitle">Download official CSV registers for vehicle pollution tests, expiry tracking, and monthly audits.</p>
        {reportNotice && <p className="form-info" style={{ marginTop: 8 }}>{reportNotice}</p>}
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
