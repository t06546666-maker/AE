import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, Gift, IndianRupee, ReceiptText, ScanLine, Sparkles, UserRoundCheck, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { CustomDates, ErrorState, ExportModal, LoadingState, PageHeader, PeriodControl } from '../components/Common';
import QrScanner from '../components/QrScanner';
import type { DashboardData, Period, RewardSettings, UserProfile, Merchant } from '../types';
import { dateInput, formatCurrency, formatPoints, rangeForChartPeriod, rangeForPeriod } from '../utils';

const emptyDashboard: DashboardData = {
  summary: { totalOrders: 0, totalRevenue: 0, rewardPointsIssued: 0, totalCustomers: 0 },
  intervals: ['00-06', '06-12', '12-18', '18-24'].map((label) => ({ label, orders: 0, revenue: 0 })),
  retention: { lifetimeCustomers: 0, selectedVisits: 0, todayVisits: 0, weekVisits: 0, monthVisits: 0 },
};

function useDashboard(period: Period, from: string, to: string) {
  const range = rangeForPeriod(period, from, to);
  return useQuery({
    queryKey: ['dashboard', range?.from, range?.to],
    queryFn: ({ signal }) => apiFetch<DashboardData>(`/api/dashboard?${queryString(range || {})}`, { signal }),
    enabled: Boolean(range),
  });
}

function useChartDashboard(period: Period, from: string, to: string) {
  const range = rangeForChartPeriod(period, from, to);
  const bucket = period === 'today' ? 'six-hour' : period === 'month' ? 'weekly' : 'daily';
  return useQuery({
    queryKey: ['dashboard', 'chart', range?.from, range?.to, bucket],
    queryFn: ({ signal }) => apiFetch<DashboardData>(
      `/api/dashboard?${queryString({ ...(range || {}), bucket })}`,
      { signal },
    ),
    enabled: Boolean(range),
  });
}

import { SubscriptionModal } from '../components/SubscriptionModal';

function ReportDates({ period, from, to, setFrom, setTo }: { period: Period; from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return period === 'custom' ? <CustomDates from={from} to={to} onFrom={setFrom} onTo={setTo} /> : null;
}

export function Dashboard({ user }: { user: UserProfile }) {
  const { t } = useTranslation();
  const today = dateInput();
  const [period, setPeriod] = useState<Period>('today');
  const [from, setFrom] = useState(today); const [to, setTo] = useState(today);
  const [chartPeriod, setChartPeriod] = useState<Period>('today');
  const [chartFrom, setChartFrom] = useState(today); const [chartTo, setChartTo] = useState(today);
  const [retentionPeriod, setRetentionPeriod] = useState<Period>('today');
  const [retentionFrom, setRetentionFrom] = useState(today); const [retentionTo, setRetentionTo] = useState(today);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const [scannerMode, setScannerMode] = useState<'earn' | 'redeem' | null>(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  const dashboard = useDashboard(period, from, to);
  const chart = useChartDashboard(chartPeriod, chartFrom, chartTo);
  const retention = useDashboard(retentionPeriod, retentionFrom, retentionTo);
  
  const merchantQuery = useQuery({
    queryKey: ['merchant', user.merchant_id],
    queryFn: ({ signal }) => apiFetch<{ data: Merchant }>(`/api/merchants/${user.merchant_id}`, { signal }),
    enabled: user.role === 'merchant' && !!user.merchant_id,
  });

  const settings = useQuery({
    queryKey: ['reward-settings'],
    queryFn: ({ signal }) => apiFetch<RewardSettings>('/api/settings/reward', { signal }),
    enabled: user.role === 'merchant' && Boolean(scannerMode),
  });
  const data = dashboard.data || emptyDashboard;
  const chartData = chart.data || emptyDashboard;
  const retentionData = retention.data || emptyDashboard;
  const maxOrders = Math.max(1, ...chartData.intervals.map((item) => item.orders));
  const maxRevenue = Math.max(1, ...chartData.intervals.map((item) => item.revenue));
  const chartNeedsScroll = chartPeriod === 'custom' && chartData.intervals.length > 7;

  if (dashboard.isError) return <><PageHeader title={t('dashboard.title')} subtitle={t(user.role === 'merchant' ? 'dashboard.merchantSubtitle' : 'dashboard.adminSubtitle')} /><ErrorState error={dashboard.error} retry={() => dashboard.refetch()} /></>;
  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t(user.role === 'merchant' ? 'dashboard.merchantSubtitle' : 'dashboard.adminSubtitle')}
        actions={<><button className="button secondary" onClick={() => setExportFormat('xlsx')}><Download size={16} />{t('dashboard.excel')}</button><button className="button secondary" onClick={() => setExportFormat('pdf')}><Download size={16} />{t('dashboard.pdf')}</button></>}
      />
      <section className="panel quick-actions quick-actions-top">
        <h2>{t('dashboard.quickActions')}</h2>
        <div>
          <Link className="button primary" to="/add-customer">{t(user.role === 'admin' ? 'dashboard.addCustomer' : 'dashboard.addBuyer')}</Link>
          {user.role === 'merchant' ? <button type="button" className="button scan-qr-action" onClick={() => setScannerMode('earn')}><ScanLine size={17} />{t('dashboard.scanQr')}</button> : null}
          {user.role === 'merchant' ? <Link className="button customer-orders-action" to="/customer-orders">Customer orders</Link> : null}
          <Link className="button secondary" to="/customers">{t('dashboard.viewCustomers')}</Link>
          <Link className="button secondary" to="/orders">{t('dashboard.viewOrders')}</Link>
          <Link className="button secondary" to="/offers"><Gift size={16} />{t(user.role === 'admin' ? 'dashboard.reviewOffers' : 'dashboard.createOffer')}</Link>
          {user.role === 'merchant' ? <button type="button" className="button primary" onClick={() => setScannerMode('redeem')}><Gift size={16}/> Redeem Points</button> : null}
          {user.role === 'merchant' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <span className="tag" style={{ background: 'var(--bg-inset)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                <strong>{merchantQuery.data?.data?.point_balance || 0}</strong> Available Points
              </span>
              <span className="tag" style={{ background: 'var(--bg-inset)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                <strong>{(merchantQuery.data?.data as any)?.total_points_redeemed || 0}</strong> Points Redeemed
              </span>
              <button type="button" className="button primary" style={{ background: '#F59E0B', color: 'white', border: 'none' }} onClick={() => setSubscribeOpen(true)}>
                Subscribe
              </button>
            </div>
          ) : null}
        </div>
      </section>
      
      {subscribeOpen && user.role === 'merchant' && merchantQuery.data?.data && (
        <SubscriptionModal merchant={merchantQuery.data.data} onClose={() => setSubscribeOpen(false)} onUpdate={() => merchantQuery.refetch()} />
      )}

      <div className="filter-row"><PeriodControl value={period} onChange={setPeriod} /><ReportDates period={period} from={from} to={to} setFrom={setFrom} setTo={setTo} /></div>
      {dashboard.isPending ? <LoadingState label="Loading dashboard" /> : (
        <div className="metric-grid">
          <article className="metric-card violet"><div><span>{t('dashboard.totalOrders')}</span><strong>{data.summary.totalOrders}</strong><small>{t('dashboard.selectedPeriod')}</small></div><ReceiptText /></article>
          <article className="metric-card green"><div><span>{t('dashboard.totalRevenue')}</span><strong>{formatCurrency(data.summary.totalRevenue)}</strong><small>{t('dashboard.selectedPeriod')}</small></div><IndianRupee /></article>
          <article className="metric-card blue"><div><span>{t('dashboard.pointsIssued')}</span><strong>{formatPoints(data.summary.rewardPointsIssued)}</strong><small>{t('dashboard.selectedPeriod')}</small></div><Sparkles /></article>
          <article className="metric-card pink"><div><span>{t('dashboard.totalCustomers')}</span><strong>{data.summary.totalCustomers}</strong><small>{t('dashboard.registeredPeriod')}</small></div><Users /></article>
        </div>
      )}

      <div className="report-grid">
        <section className="panel">
          <div className="report-head"><div><h2>{t('dashboard.ordersRevenue')}</h2><p>{t(chartPeriod === 'today' ? 'dashboard.sixHours' : chartPeriod === 'month' ? 'dashboard.weeklyBreakdown' : 'dashboard.dailyBreakdown')}</p></div><PeriodControl compact value={chartPeriod} onChange={setChartPeriod} /></div>
          <ReportDates period={chartPeriod} from={chartFrom} to={chartTo} setFrom={setChartFrom} setTo={setChartTo} />
          {chart.isFetching ? <div className="inline-loading">Updating chart...</div> : null}
          <div className="chart-scroll">
            <div
              className={`grouped-chart${chartPeriod === 'today' ? '' : ' daily-chart'}`}
              style={chartPeriod === 'today' ? undefined : {
                gridTemplateColumns: `repeat(${chartData.intervals.length}, minmax(${chartNeedsScroll ? 28 : 0}px, 1fr))`,
                minWidth: chartNeedsScroll ? `${chartData.intervals.length * 38}px` : '100%',
              }}
            >
              {chartData.intervals.map((item) => (
                <div className="chart-group" key={item.label}>
                  <div className="chart-bars">
                    <div className="chart-bar orders" style={{ height: `${Math.max(4, item.orders / maxOrders * 100)}%` }} title={`${item.orders} orders`} />
                    <div className="chart-bar revenue" style={{ height: `${Math.max(4, item.revenue / maxRevenue * 100)}%` }} title={formatCurrency(item.revenue)} />
                  </div><span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-legend"><span><i className="orders" />{t('dashboard.orders')}</span><span><i className="revenue" />{t('dashboard.revenue')}</span></div>
        </section>
        <section className="panel">
          <div className="report-head"><div><h2>{t('dashboard.retention')}</h2><p>{t('dashboard.returningVisits')}</p></div><PeriodControl compact value={retentionPeriod} onChange={setRetentionPeriod} /></div>
          <ReportDates period={retentionPeriod} from={retentionFrom} to={retentionTo} setFrom={setRetentionFrom} setTo={setRetentionTo} />
          <div className="retention-total"><strong>{retentionData.retention.selectedVisits}</strong><span>{t('dashboard.selectedVisits')}</span></div>
          <div className="retention-lifetime"><UserRoundCheck /><strong>{retentionData.retention.lifetimeCustomers}</strong><span>{t('dashboard.lifetimeRetained')}</span></div>
          <div className="retention-list"><div><span>{t('dashboard.today')}</span><strong>{retentionData.retention.todayVisits}</strong></div><div><span>{t('dashboard.weekly')}</span><strong>{retentionData.retention.weekVisits}</strong></div><div><span>{t('dashboard.monthly')}</span><strong>{retentionData.retention.monthVisits}</strong></div></div>
        </section>
      </div>
      {Boolean(scannerMode) ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setScannerMode(null); }}>
          <div className="modal scanner-modal" role="dialog" aria-modal="true" aria-label={t('dashboard.scanQr')}>
            <button type="button" className="icon-button modal-close" title={t('common.close')} onClick={() => setScannerMode(null)}><X /></button>
            {settings.isPending ? <LoadingState label={`${t('common.loading')} scanner`} /> : null}
            {settings.isError ? <ErrorState error={settings.error} retry={() => settings.refetch()} /> : null}
            {settings.data ? <QrScanner settings={settings.data} mode={scannerMode as any} merchantId={user.merchant_id || undefined} autoStart /> : null}
          </div>
        </div>
      ) : null}
      
      <ExportModal open={Boolean(exportFormat)} format={exportFormat || 'xlsx'} isAdmin={user.role === 'admin'} onClose={() => setExportFormat(null)} />
    </>
  );
}
