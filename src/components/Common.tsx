import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Download, LoaderCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <div className="state-panel error-state">
      <AlertCircle size={22} />
      <span>{error.message}</span>
      {retry ? <button className="button secondary" onClick={retry}>{t('common.retry')}</button> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function PaginationBar({ pagination, onPage }: { pagination?: Pagination; onPage: (page: number) => void }) {
  const { t } = useTranslation();
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="pagination-bar">
      <span>{t('common.page')} {pagination.page} {t('common.of')} {pagination.totalPages} · {pagination.total} {t('common.records')}</span>
      <div>
        <button className="icon-button" title={t('common.previous')} disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}><ChevronLeft /></button>
        <button className="icon-button" title={t('common.next')} disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}><ChevronRight /></button>
      </div>
    </div>
  );
}

const periodOptions: Array<[Period, string]> = [
  ['today', 'dashboard.today'],
  ['week', 'dashboard.weekly'],
  ['month', 'dashboard.monthly'],
  ['custom', 'common.custom'],
];

export function PeriodControl({ value, onChange, compact = false }: {
  value: Period;
  onChange: (period: Period) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={`segmented ${compact ? 'compact' : ''}`}>
      {periodOptions.map(([id, label]) => (
        <button key={id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>{t(label)}</button>
      ))}
    </div>
  );
}

export function CustomDates({ from, to, onFrom, onTo }: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="date-fields">
      <label>{t('common.from')}<input type="date" value={from} onChange={(event) => onFrom(event.target.value)} /></label>
      <label>{t('common.to')}<input type="date" value={to} onChange={(event) => onTo(event.target.value)} /></label>
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
  const { t } = useTranslation();
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
    setBusy(true);
    setError('');
    try {
      const query = queryString({ ...range, section, merchantId });
      await downloadExport(`/api/exports/full.${format}?${query}`);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <button className="icon-button modal-close" title={t('common.close')} onClick={onClose}><X /></button>
        <h2 id="export-title">{t('export.title')}</h2>
        <p>{t('export.description')}</p>
        <div className="two-column-form">
          <label>{t('common.from')}<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>{t('common.to')}<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        <label>{t('export.content')}
          <select value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="all">{t('export.all')}</option>
            <option value="summary">{t('export.summary')}</option>
            <option value="orders">{t('dashboard.orders')}</option>
            <option value="points">{t('export.points')}</option>
            {isAdmin ? <option value="merchants">{t('nav.merchants')}</option> : null}
          </select>
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>{t('offers.cancel')}</button>
          <button className="button primary" disabled={busy} onClick={submit}>
            <Download size={16} />{busy ? t('export.preparing') : `${t('export.download')} ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
