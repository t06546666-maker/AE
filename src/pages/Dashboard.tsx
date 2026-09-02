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
import type { DashboardData, Period, RewardSettings, UserProfile, Merchant, Order, Customer } from '../types';
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

function HelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'Hi there! 👋 How can we help you today? Please choose from our frequently asked questions below:' }
  ]);
  const faqs = [
    { q: 'How do I add a new customer?', a: 'You can add a new customer from the Customers tab by clicking the Add button, or simply by scanning their QR code from your phone.' },
    { q: 'How do reward points get calculated?', a: 'Points are calculated automatically based on your Reward Settings, which you can configure in the settings area. The pending liability shows the total value of unused points.' },
    { q: 'Can I change my subscription?', a: 'Yes! You can manage your subscription by clicking the billing settings icon. You can upgrade or downgrade your plan at any time.' },
  ];

  const ask = (q: string, a: string) => {
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'bot', text: a }]);
    }, 500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '65vh', background: 'white' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#3b28cc', color: 'white', borderRadius: '8px 8px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Headset size={20} color="white" />
            <h2 style={{ margin: 0, fontSize: 16, color: 'white' }}>AE Support Chat</h2>
          </div>
          <button className="icon-button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', padding: 0 }}><X size={24} color="white" /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, background: '#f8fafc' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#3b28cc' : '#ffffff', color: m.role === 'user' ? 'white' : '#1e293b', padding: '12px 16px', borderRadius: 16, borderBottomLeftRadius: m.role === 'bot' ? 4 : 16, borderBottomRightRadius: m.role === 'user' ? 4 : 16, maxWidth: '85%', fontSize: 13, lineHeight: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              {m.text}
            </div>
          ))}
        </div>
        <div style={{ padding: 16, background: 'white', borderTop: '1px solid #f1f5f9', borderRadius: '0 0 8px 8px' }}>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 10px', fontWeight: 600, textTransform: 'uppercase' }}>Frequently Asked Questions</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {faqs.map((faq, i) => (
              <button key={i} onClick={() => ask(faq.q, faq.a)} style={{ background: '#f1f5f9', border: 'none', padding: '10px 14px', borderRadius: 20, fontSize: 12, color: '#334155', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}>
                {faq.q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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
  const [helpOpen, setHelpOpen] = useState(false);

  const dashboard = useDashboard(period, from, to);
  const data = dashboard.data || emptyDashboard;
  
  const recentOrders = useQuery({
    queryKey: ['recent-orders'],
    queryFn: ({ signal }) => apiFetch<{ orders: Order[] }>(`/api/orders?page=1&pageSize=5`, { signal }),
    enabled: user.role === 'merchant',
  });

  const topCustomers = useQuery({
    queryKey: ['top-customers'],
    queryFn: ({ signal }) => apiFetch<{ customers: Customer[] }>(`/api/customers?page=1&pageSize=3`, { signal }),
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
                <div className="mobile-transaction-avatar blue">{initials(order.customer || '?')}</div>
                <div className="mobile-transaction-info">
                  <h4>{order.customer || 'Walk-in Customer'}</h4>
                  <p>{formatDate(order.timestamp)} • {formatTime(order.timestamp)}</p>
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

      {/* Business Overview */}
      {user.role === 'merchant' ? (
        <div className="mobile-panel" style={{ marginTop: 24 }}>
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
      ) : null}

      {/* Top Customers Today */}
      {user.role === 'merchant' ? (
        <div className="mobile-section">
          <div className="mobile-section-header">
            <h3>Top Customers Today</h3>
            <Link to="/customers">View all</Link>
          </div>
          <div className="mobile-transactions">
            {topCustomers.isPending ? <LoadingState label={t('common.loading', 'Loading...')} /> : 
             !topCustomers.data?.customers?.length ? <p style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px', margin: 0 }}>No customers today.</p> :
              topCustomers.data.customers.slice(0, 3).map((customer, index) => (
              <div className="mobile-transaction-item" key={customer.id}>
                <div className={`mobile-transaction-avatar ${index === 0 ? 'green' : index === 1 ? 'pink' : 'blue'}`}>{index + 1}</div>
                <div className="mobile-transaction-info">
                  <h4>{customer.name || 'Walk-in Customer'}</h4>
                  <p>{customer.orderCount || 1} {t('dashboard.orders', 'orders')} • ₹{formatCurrency(customer.totalSpend || 0)}</p>
                </div>
                <div className="mobile-transaction-amount">
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>+{formatPoints(customer.totalRewardPoints ?? customer.rewardPoints ?? 0)} pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Rewards Summary */}
      {user.role === 'merchant' ? (
        <div className="mobile-section">
          <div className="mobile-transactions" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: '0 0 16px' }}>Rewards Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Total Points Issued</span>
              <strong style={{ fontSize: 14, color: '#1a1a1a' }}>{formatPoints(data.summary.rewardPointsIssued || 0)} pts</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Total Points Redeemed</span>
              <strong style={{ fontSize: 14, color: '#1a1a1a' }}>0 pts</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Pending Liability</span>
              <strong style={{ fontSize: 14, color: '#ea580c' }}>₹{formatCurrency((data.summary.rewardPointsIssued || 0) * 0.1)}</strong>
            </div>
          </div>
        </div>
      ) : null}

      {/* Create Offer CTA */}
      {user.role === 'merchant' ? (
        <div className="mobile-section">
          <div style={{ background: '#f5f3ff', borderRadius: 16, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', margin: '0 0 12px' }}>Create offers and attract<br/>more customers</h3>
              <Link to="/offers" className="button" style={{ background: 'white', color: '#3b28cc', fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'inline-block', textDecoration: 'none' }}>Create Offer</Link>
            </div>
            <div style={{ background: '#3b28cc', width: 64, height: 64, borderRadius: 16, display: 'grid', placeItems: 'center' }}>
              <Gift size={32} color="white" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Help & Support */}
      {user.role === 'merchant' ? (
        <div className="mobile-section">
          <div style={{ background: '#f8fafc', borderRadius: 16, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>Need help?</h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>Visit our Help Center or contact support.</p>
            <button onClick={() => setHelpOpen(true)} style={{ background: 'white', width: '100%', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 12, color: '#1a1a1a', fontWeight: 600, fontSize: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Headset size={20} color="#1a1a1a" strokeWidth={2} />
                <span>Help & Support</span>
              </div>
              <ChevronRight size={18} color="#1a1a1a" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      ) : null}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {/* Subscription Callout */}
      {subscribeOpen && user.role === 'merchant' && merchantQuery.data?.data && (
        <SubscriptionModal merchant={merchantQuery.data.data} onClose={() => setSubscribeOpen(false)} onUpdate={() => merchantQuery.refetch()} />
      )}
    </div>
  );
}
