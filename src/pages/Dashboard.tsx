import { lazy, Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, IndianRupee, ReceiptText, Sparkles, UserRoundCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { CustomDates, ErrorState, ExportModal, LoadingState, PageHeader, PeriodControl } from '../components/Common';
import type { DashboardData, Period, RewardSettings, UserProfile } from '../types';
import { dateInput, formatCurrency, formatPoints, rangeForPeriod } from '../utils';

const QrScanner = lazy(() => import('../components/QrScanner'));
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

function ReportDates({ period, from, to, setFrom, setTo }: { period: Period; from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return period === 'custom' ? <CustomDates from={from} to={to} onFrom={setFrom} onTo={setTo} /> : null;
}

export function Dashboard({ user }: { user: UserProfile }) {
  const today = dateInput();
  const [period, setPeriod] = useState<Period>('today');
  const [from, setFrom] = useState(today); const [to, setTo] = useState(today);
  const [chartPeriod, setChartPeriod] = useState<Period>('today');
  const [chartFrom, setChartFrom] = useState(today); const [chartTo, setChartTo] = useState(today);
  const [retentionPeriod, setRetentionPeriod] = useState<Period>('today');
  const [retentionFrom, setRetentionFrom] = useState(today); const [retentionTo, setRetentionTo] = useState(today);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const dashboard = useDashboard(period, from, to);
  const chart = useDashboard(chartPeriod, chartFrom, chartTo);
  const retention = useDashboard(retentionPeriod, retentionFrom, retentionTo);
  const settings = useQuery({ queryKey: ['reward-settings'], queryFn: ({ signal }) => apiFetch<RewardSettings>('/api/settings/reward', { signal }) });
  const data = dashboard.data || emptyDashboard;
  const chartData = chart.data || emptyDashboard;
  const retentionData = retention.data || emptyDashboard;
  const maxOrders = Math.max(1, ...chartData.intervals.map((item) => item.orders));
  const maxRevenue = Math.max(1, ...chartData.intervals.map((item) => item.revenue));

  if (dashboard.isError) return <><PageHeader title="Dashboard" subtitle="Business performance and customer retention." /><ErrorState error={dashboard.error} retry={() => dashboard.refetch()} /></>;
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={user.role === 'merchant' ? 'Store performance and QR checkout.' : 'Business performance across all merchants.'}
        actions={<><button className="button secondary" onClick={() => setExportFormat('xlsx')}><Download size={16} />Excel</button><button className="button secondary" onClick={() => setExportFormat('pdf')}><Download size={16} />PDF</button></>}
      />
      <div className="filter-row"><PeriodControl value={period} onChange={setPeriod} /><ReportDates period={period} from={from} to={to} setFrom={setFrom} setTo={setTo} /></div>
      {dashboard.isPending ? <LoadingState label="Loading dashboard" /> : (
        <div className="metric-grid">
          <article className="metric-card violet"><div><span>Total orders</span><strong>{data.summary.totalOrders}</strong><small>Selected period</small></div><ReceiptText /></article>
          <article className="metric-card green"><div><span>Total revenue</span><strong>{formatCurrency(data.summary.totalRevenue)}</strong><small>Selected period</small></div><IndianRupee /></article>
          <article className="metric-card blue"><div><span>Reward points issued</span><strong>{formatPoints(data.summary.rewardPointsIssued)}</strong><small>Selected period</small></div><Sparkles /></article>
          <article className="metric-card pink"><div><span>Total customers</span><strong>{data.summary.totalCustomers}</strong><small>Registered in period</small></div><Users /></article>
        </div>
      )}

      {user.role === 'merchant' && settings.data ? <Suspense fallback={<LoadingState label="Preparing scanner" />}><QrScanner settings={settings.data} /></Suspense> : null}

      <div className="report-grid">
        <section className="panel">
          <div className="report-head"><div><h2>Orders and revenue</h2><p>Grouped into six-hour intervals.</p></div><PeriodControl compact value={chartPeriod} onChange={setChartPeriod} /></div>
          <ReportDates period={chartPeriod} from={chartFrom} to={chartTo} setFrom={setChartFrom} setTo={setChartTo} />
          {chart.isFetching ? <div className="inline-loading">Updating chart...</div> : null}
          <div className="grouped-chart">
            {chartData.intervals.map((item) => (
              <div className="chart-group" key={item.label}>
                <div className="chart-bars">
                  <div className="chart-bar orders" style={{ height: `${Math.max(4, item.orders / maxOrders * 100)}%` }} title={`${item.orders} orders`} />
                  <div className="chart-bar revenue" style={{ height: `${Math.max(4, item.revenue / maxRevenue * 100)}%` }} title={formatCurrency(item.revenue)} />
                </div><span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="chart-legend"><span><i className="orders" />Orders</span><span><i className="revenue" />Revenue</span></div>
        </section>
        <section className="panel">
          <div className="report-head"><div><h2>Retention</h2><p>Returning customer visits.</p></div><PeriodControl compact value={retentionPeriod} onChange={setRetentionPeriod} /></div>
          <ReportDates period={retentionPeriod} from={retentionFrom} to={retentionTo} setFrom={setRetentionFrom} setTo={setRetentionTo} />
          <div className="retention-total"><strong>{retentionData.retention.selectedVisits}</strong><span>Returning visits in selected period</span></div>
          <div className="retention-lifetime"><UserRoundCheck /><strong>{retentionData.retention.lifetimeCustomers}</strong><span>lifetime retained customers</span></div>
          <div className="retention-list"><div><span>Today</span><strong>{retentionData.retention.todayVisits}</strong></div><div><span>Weekly</span><strong>{retentionData.retention.weekVisits}</strong></div><div><span>Monthly</span><strong>{retentionData.retention.monthVisits}</strong></div></div>
        </section>
      </div>
      <section className="panel quick-actions"><h2>Quick actions</h2><div><Link className="button primary" to="/add-customer">Add {user.role === 'admin' ? 'customer' : 'buyer'}</Link><Link className="button secondary" to="/customers">View customers & QR</Link><Link className="button secondary" to="/orders">View orders</Link></div></section>
      <ExportModal open={Boolean(exportFormat)} format={exportFormat || 'xlsx'} isAdmin={user.role === 'admin'} onClose={() => setExportFormat(null)} />
    </>
  );
}
