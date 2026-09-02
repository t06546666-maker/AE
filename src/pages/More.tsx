import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronRight, FileSpreadsheet, Headset, LogOut, FileText, Settings, ShieldCheck, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { CustomDates, ExportModal, PageHeader, PeriodControl } from '../components/Common';
import { SubscriptionModal } from '../components/SubscriptionModal';
import type { DashboardData, Period, UserProfile, Merchant } from '../types';
import { dateInput, formatCurrency, rangeForChartPeriod } from '../utils';

const emptyDashboard: DashboardData = {
  summary: { totalOrders: 0, totalRevenue: 0, rewardPointsIssued: 0, totalCustomers: 0 },
  intervals: ['00-06', '06-12', '12-18', '18-24'].map((label) => ({ label, orders: 0, revenue: 0 })),
  retention: { lifetimeCustomers: 0, selectedVisits: 0, todayVisits: 0, weekVisits: 0, monthVisits: 0 },
};

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

function ReportDates({ period, from, to, setFrom, setTo }: { period: Period; from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return period === 'custom' ? <CustomDates from={from} to={to} onFrom={setFrom} onTo={setTo} /> : null;
}

export function More({ user }: { user: UserProfile }) {
  const { t } = useTranslation();
  const today = dateInput();
  const [chartPeriod, setChartPeriod] = useState<Period>('today');
  const [chartFrom, setChartFrom] = useState(today); const [chartTo, setChartTo] = useState(today);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  const chart = useChartDashboard(chartPeriod, chartFrom, chartTo);
  const chartData = chart.data || emptyDashboard;
  const maxOrders = Math.max(1, ...chartData.intervals.map((item) => item.orders));
  const maxRevenue = Math.max(1, ...chartData.intervals.map((item) => item.revenue));
  const chartNeedsScroll = chartPeriod === 'custom' && chartData.intervals.length > 7;

  const merchantQuery = useQuery({
    queryKey: ['merchant', user.merchant_id],
    queryFn: ({ signal }) => apiFetch<{ data: Merchant }>(`/api/merchants/${user.merchant_id}`, { signal }),
    enabled: user.role === 'merchant' && !!user.merchant_id,
  });

  return (
    <div className="mobile-dashboard-wrapper" style={{ paddingBottom: '80px' }}>
      <PageHeader title={t('nav.more', 'More')} />

      {/* Business Overview */}
      <div className="mobile-panel" style={{ marginTop: 16 }}>
        <div className="mobile-panel-header">
          <h3>{t('dashboard.businessOverview', 'Business Overview')}</h3>
          <div style={{ width: '120px' }}>
            <PeriodControl compact value={chartPeriod} onChange={setChartPeriod} />
          </div>
        </div>
        <ReportDates period={chartPeriod} from={chartFrom} to={chartTo} setFrom={setChartFrom} setTo={setChartTo} />
        
        <div style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>{t('dashboard.salesOverview', 'Sales Overview')}</strong>
          <div className="chart-legend" style={{ marginTop: 0, marginBottom: 16 }}>
            <span><i className="orders" style={{ background: '#3b28cc'}} /> {t('dashboard.orders', 'Orders')}</span>
            <span><i className="revenue" style={{ background: '#16a34a'}} /> {t('dashboard.revenue', 'Revenue (₹)')}</span>
          </div>
          {chart.isFetching ? <div className="inline-loading">Updating chart...</div> : null}
          <div className="chart-scroll">
            <div className={`grouped-chart${chartPeriod === 'today' ? '' : ' daily-chart'}`} style={chartPeriod === 'today' ? undefined : { gridTemplateColumns: `repeat(${chartData.intervals.length}, minmax(${chartNeedsScroll ? 28 : 0}px, 1fr))`, minWidth: chartNeedsScroll ? `${chartData.intervals.length * 38}px` : '100%' }}>
              {chartData.intervals.map((item) => (
                <div className="chart-group" key={item.label}>
                  <div className="chart-bars">
                    <div className="chart-bar orders" style={{ height: `${Math.max(4, item.orders / maxOrders * 100)}%`, background: '#3b28cc' }} title={`${item.orders} orders`} />
                    <div className="chart-bar revenue" style={{ height: `${Math.max(4, item.revenue / maxRevenue * 100)}%`, background: '#16a34a' }} title={formatCurrency(item.revenue)} />
                  </div><span>{item.label}</span>
                </div>
              ))}
            </div>
            {chartPeriod === 'today' && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, textAlign: 'center' }}>{t('dashboard.sixHours', 'Grouped into six-hour intervals.')}</p>}
          </div>
        </div>
      </div>

      {/* Account Settings & Exports */}
      <div className="mobile-section" style={{ marginTop: 24 }}>
        <div className="mobile-section-header">
          <h3>Account & Tools</h3>
        </div>
        <div className="mobile-transactions" style={{ boxShadow: 'none', padding: 0 }}>
          <button className="mobile-transaction-item" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }} onClick={() => setExportFormat('xlsx')}>
            <div className="mobile-transaction-avatar green" style={{ width: 40, height: 40 }}><FileSpreadsheet size={20} /></div>
            <div className="mobile-transaction-info" style={{ textAlign: 'left' }}>
              <h4>Export to Excel</h4>
              <p>Download full business reports</p>
            </div>
            <ChevronRight color="#94a3b8" />
          </button>
          
          <button className="mobile-transaction-item" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }} onClick={() => setExportFormat('pdf')}>
            <div className="mobile-transaction-avatar pink" style={{ width: 40, height: 40 }}><FileText size={20} /></div>
            <div className="mobile-transaction-info" style={{ textAlign: 'left' }}>
              <h4>Export to PDF</h4>
              <p>Download visual summaries</p>
            </div>
            <ChevronRight color="#94a3b8" />
          </button>

          <button className="mobile-transaction-item" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }} onClick={() => setSubscribeOpen(true)}>
            <div className="mobile-transaction-avatar blue" style={{ width: 40, height: 40 }}><ShieldCheck size={20} /></div>
            <div className="mobile-transaction-info" style={{ textAlign: 'left' }}>
              <h4>Subscription</h4>
              <p>Manage your plan and billing</p>
            </div>
            <ChevronRight color="#94a3b8" />
          </button>

          <Link to="/reward-settings" className="mobile-transaction-item" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '16px 0' }}>
            <div className="mobile-transaction-avatar" style={{ width: 40, height: 40, background: '#f1f5f9', color: '#64748b' }}><Settings size={20} /></div>
            <div className="mobile-transaction-info" style={{ textAlign: 'left' }}>
              <h4>Reward Settings</h4>
              <p>Configure points and expiry</p>
            </div>
            <ChevronRight color="#94a3b8" />
          </Link>
        </div>
      </div>

      {/* Help and Support */}
      <div className="mobile-help-support" style={{ marginTop: 24 }}>
        <p>{t('dashboard.needHelpTitle', 'Need help?')}<br/>{t('dashboard.needHelpSub', 'Visit our Help Center or contact support.')}</p>
        <Link to="/contact" className="mobile-help-btn">
          <div className="mobile-help-btn-left">
            <Headset size={20} color="#64748b" />
            <span>{t('dashboard.helpSupport', 'Help & Support')}</span>
          </div>
          <ChevronRight size={20} color="#94a3b8" />
        </Link>
      </div>

      <ExportModal open={Boolean(exportFormat)} format={exportFormat || 'xlsx'} isAdmin={user.role === 'admin'} onClose={() => setExportFormat(null)} />
      
      {subscribeOpen && user.role === 'merchant' && merchantQuery.data?.data && (
        <SubscriptionModal merchant={merchantQuery.data.data} onClose={() => setSubscribeOpen(false)} onUpdate={() => merchantQuery.refetch()} />
      )}
    </div>
  );
}
