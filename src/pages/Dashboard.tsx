import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  Bell, ChevronRight, Download, Gift, Headset, Home, IndianRupee, Menu, MoreHorizontal, ReceiptText, QrCode, ScanLine, Sparkles, Tag, UserRoundCheck, Users, X, BadgeIndianRupee 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { CustomDates, ErrorState, ExportModal, LoadingState, PageHeader, PeriodControl } from '../components/Common';
import QrScanner from '../components/QrScanner';
import type { DashboardData, Period, RewardSettings, UserProfile, Merchant, Order } from '../types';
import { dateInput, formatCurrency, formatPoints, rangeForChartPeriod, rangeForPeriod, formatDate, formatTime, initials } from '../utils';
import { SubscriptionModal } from '../components/SubscriptionModal';

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
  const data = dashboard.data || emptyDashboard;
  
  const recentOrders = useQuery({
    queryKey: ['recent-orders'],
    queryFn: ({ signal }) => apiFetch<{ orders: Order[] }>(`/api/orders?page=1&pageSize=5`, { signal }),
    enabled: user.role === 'merchant',
  });

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

  const chartData = chart.data || emptyDashboard;
  const retentionData = retention.data || emptyDashboard;
  const maxOrders = Math.max(1, ...chartData.intervals.map((item) => item.orders));
  const maxRevenue = Math.max(1, ...chartData.intervals.map((item) => item.revenue));
  const chartNeedsScroll = chartPeriod === 'custom' && chartData.intervals.length > 7;
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.goodMorning', 'Good morning!');
    if (hour < 17) return t('dashboard.goodAfternoon', 'Good afternoon!');
    return t('dashboard.goodEvening', 'Good evening!');
  };

  if (dashboard.isError) return <><PageHeader title={t('dashboard.title')} subtitle={t(user.role === 'merchant' ? 'dashboard.merchantSubtitle' : 'dashboard.adminSubtitle')} /><ErrorState error={dashboard.error} retry={() => dashboard.refetch()} /></>;

  return (
    <div className="mobile-dashboard-wrapper">
      {/* Greeting */}
      <div className="mobile-greeting">
        <h1>{getGreeting()}</h1>
        <p>{t('dashboard.growBusiness', 'Let\'s grow your business today.')}</p>
      </div>

      {/* Main Action - Scan QR */}
      {user.role === 'merchant' ? (
        <>
          <button className="mobile-main-action" onClick={() => setScannerMode('earn')}>
            <div className="mobile-main-action-content">
              <div className="mobile-main-action-icon"><QrCode /></div>
              <div className="mobile-main-action-text">
                <h2>{t('dashboard.scanQrActionTitle', 'Scan QR')}</h2>
                <p>{t('dashboard.newSale', 'New Sale')}</p>
              </div>
            </div>
            <ChevronRight color="white" opacity={0.8} />
          </button>
          <Link to="/add-customer" className="mobile-sub-action">
             <div className="mobile-sub-action-text">
               <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '8px' }}><Users size={20} color="#3b28cc" /></div>
               <div>
                 <p>{t('dashboard.noQrPrompt', 'Customer doesn\'t have QR?')}</p>
                 <strong>{t('dashboard.enterMobile', 'Enter mobile number')}</strong>
               </div>
             </div>
             <ChevronRight color="#94a3b8" />
          </Link>
        </>
      ) : null}

      {/* Today's Summary */}
      <div className="mobile-section">
        <div className="mobile-section-header">
          <h3>{t('dashboard.todaysSummary', 'Today\'s Summary')}</h3>
          <Link to="/reports">{t('common.viewAll', 'View all')}</Link>
        </div>
        {dashboard.isPending ? <LoadingState label="Loading" /> : (
          <div className="mobile-summary-cards">
            <div className="mobile-summary-card sales">
              <div className="mobile-summary-card-icon"><BadgeIndianRupee size={24} strokeWidth={1.5} /></div>
              <p>{t('dashboard.sales', 'Sales')}</p>
              <strong>{formatCurrency(data.summary.totalRevenue)}</strong>
              <small>{data.summary.totalOrders} {t('dashboard.orders', 'Orders')}</small>
            </div>
            <div className="mobile-summary-card customers">
              <div className="mobile-summary-card-icon"><Users size={24} strokeWidth={1.5} /></div>
              <p>{t('dashboard.customers', 'Customers')}</p>
              <strong>{formatCurrency(data.summary.totalCustomers)}</strong>
              <small>New: {retentionData.retention.todayVisits}</small> 
            </div>
            <div className="mobile-summary-card rewards">
              <div className="mobile-summary-card-icon"><Gift size={24} strokeWidth={1.5} /></div>
              <p>{t('dashboard.rewards', 'Rewards')}</p>
              <strong>{formatCurrency(data.summary.rewardPointsIssued)}</strong>
              <small>{t('dashboard.issued', 'Issued')}</small>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mobile-section">
        <div className="mobile-section-header">
          <h3>{t('dashboard.quickActionsTitle', 'Quick Actions')}</h3>
        </div>
        <div className="mobile-quick-actions">
          {user.role === 'merchant' && (
            <button className="mobile-quick-action" onClick={() => setScannerMode('redeem')}>
              <div className="mobile-quick-action-icon"><Gift size={24} /></div>
              <span>{t('dashboard.redeemPointsBtn', 'Redeem Points')}</span>
            </button>
          )}
          <Link to="/customers" className="mobile-quick-action">
            <div className="mobile-quick-action-icon"><Users size={24} /></div>
            <span>{t('nav.customers', 'Customers')}</span>
          </Link>
          <Link to="/offers" className="mobile-quick-action">
            <div className="mobile-quick-action-icon"><Tag size={24} /></div>
            <span>{t('nav.offers', 'Offers')}</span>
          </Link>
          <Link to="/orders" className="mobile-quick-action">
            <div className="mobile-quick-action-icon"><ReceiptText size={24} /></div>
            <span>{t('nav.orders', 'Orders')}</span>
          </Link>
        </div>
      </div>

      {/* Scanner Modal */}
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
      
      {/* Recent Transactions */}
      {user.role === 'merchant' ? (
        <div className="mobile-section">
          <div className="mobile-section-header">
            <h3>{t('dashboard.recentTransactions', 'Recent Transactions')}</h3>
            <Link to="/orders">{t('common.viewAll', 'View all')}</Link>
          </div>
          <div className="mobile-transactions">
            {recentOrders.isPending ? <LoadingState label={t('common.loading', 'Loading...')} /> : 
             !recentOrders.data?.orders?.length ? <p style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px', margin: 0 }}>No recent transactions.</p> :
              recentOrders.data?.orders.slice(0, 5).map((order) => (
              <Link to={`/orders?search=${order.orderNo}`} key={order.id} className="mobile-transaction-item" style={{ textDecoration: 'none' }}>
                <div className="mobile-transaction-avatar blue">{initials(order.customer?.name || '?')}</div>
                <div className="mobile-transaction-info">
                  <h4>{order.customer?.name || 'Walk-in Customer'}</h4>
                  <p>{formatDate(order.date)} • {formatTime(order.date)}</p>
                </div>
                <div className="mobile-transaction-amount">
                  <strong>₹{formatCurrency(order.amount)}</strong>
                  {order.rewardPoints ? <span>+{formatPoints(order.rewardPoints)}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Subscription Callout */}
      {subscribeOpen && user.role === 'merchant' && merchantQuery.data?.data && (
        <SubscriptionModal merchant={merchantQuery.data.data} onClose={() => setSubscribeOpen(false)} onUpdate={() => merchantQuery.refetch()} />
      )}
    </div>
  );
}
