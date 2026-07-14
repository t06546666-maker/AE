import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Download, LoaderCircle, X } from 'lucide-react';
import { downloadExport, queryString } from '../api';
import type { Pagination, Period } from '../types';
import { dateInput, rangeForPeriod } from '../utils';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div><h1>{title}</h1><p>{subtitle}</p></div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function LoadingState({ label = 'Loading data' }: { label?: string }) {
  return <div className="state-panel"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>;
}

export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="state-panel error-state">
      <AlertCircle size={22} />
      <span>{error.message}</span>
      {retry ? <button className="button secondary" onClick={retry}>Try again</button> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function PaginationBar({ pagination, onPage }: { pagination?: Pagination; onPage: (page: number) => void }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="pagination-bar">
      <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} records</span>
      <div>
        <button className="icon-button" title="Previous page" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}><ChevronLeft /></button>
        <button className="icon-button" title="Next page" disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}><ChevronRight /></button>
      </div>
    </div>
  );
}

const periodOptions: Array<[Period, string]> = [
  ['today', 'Today'], ['week', 'Weekly'], ['month', 'Monthly'], ['custom', 'Custom'],
];

export function PeriodControl({ value, onChange, compact = false }: {
  value: Period;
  onChange: (period: Period) => void;
  compact?: boolean;
}) {
  return (
    <div className={`segmented ${compact ? 'compact' : ''}`}>
      {periodOptions.map(([id, label]) => (
        <button key={id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  );
}

export function CustomDates({ from, to, onFrom, onTo }: {
  from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void;
}) {
  return (
    <div className="date-fields">
      <label>From<input type="date" value={from} onChange={(event) => onFrom(event.target.value)} /></label>
      <label>To<input type="date" value={to} onChange={(event) => onTo(event.target.value)} /></label>
    </div>
  );
}

export function ExportModal({ open, format, merchantId, isAdmin, onClose }: {
  open: boolean;
  format: 'xlsx' | 'pdf';
  merchantId?: string;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const today = dateInput();
  const monthStart = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [section, setSection] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) setError(''); }, [open]);
  if (!open) return null;

  async function submit() {
    const range = rangeForPeriod('custom', from, to);
    if (!range) return setError('Choose both dates.');
    setBusy(true); setError('');
    try {
      const query = queryString({ ...range, section, merchantId });
      await downloadExport(`/api/exports/full.${format}?${query}`);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <button className="icon-button modal-close" title="Close" onClick={onClose}><X /></button>
        <h2 id="export-title">Export report</h2>
        <p>Choose a date range and the records you want.</p>
        <div className="two-column-form">
          <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        <label>Report content
          <select value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="all">All details</option>
            <option value="summary">Summary only</option>
            <option value="orders">Orders</option>
            <option value="points">Customers and points</option>
            {isAdmin ? <option value="merchants">Merchants</option> : null}
          </select>
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={busy} onClick={submit}><Download size={16} />{busy ? 'Preparing' : `Download ${format.toUpperCase()}`}</button>
        </div>
      </div>
    </div>
  );
}
