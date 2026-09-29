import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronRight, FileSpreadsheet, Headset, LogOut, FileText, Settings, ShieldCheck, CreditCard, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { CustomDates, ExportModal, PageHeader, PeriodControl } from '../components/Common';
import { SubscriptionModal } from '../components/SubscriptionModal';
import type { DashboardData, Period, UserProfile, Merchant } from '../types';
import { dateInput, formatCurrency, rangeForChartPeriod } from '../utils';
import { useToast } from '../toast';

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

export function More({ user, onLogout }: { user: UserProfile; onLogout: () => void }) {
  const { t } = useTranslation();
  const today = dateInput();
  const [chartPeriod, setChartPeriod] = useState<Period>('today');
  const [chartFrom, setChartFrom] = useState(today); const [chartTo, setChartTo] = useState(today);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

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
  const paymentSettings = useQuery({
    queryKey: ['merchant-payment-settings', user.merchant_id],
    queryFn: ({ signal }) => apiFetch<{ data: { upiId: string; displayName: string; paymentEnabled: boolean; mode: 'test' | 'live' } }>(`/api/merchants/${user.merchant_id}/payment-settings`, { signal }),
    enabled: user.role === 'merchant' && !!user.merchant_id,
  });

  return (
    <div className="mobile-dashboard-wrapper" style={{ paddingBottom: '80px' }}>
      <PageHeader title={t('nav.more', 'More')} subtitle="" />

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
          {user.role === 'merchant' ? <button className="mobile-transaction-item" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '16px 0' }} onClick={() => setPaymentOpen(true)}>
            <div className="mobile-transaction-avatar green" style={{ width: 40, height: 40 }}><CreditCard size={20} /></div>
            <div className="mobile-transaction-info" style={{ textAlign: 'left' }}><h4>Payment &amp; UPI Settings</h4><p>{paymentSettings.data?.data?.upiId || 'Add your UPI ID for customer payments'}</p></div>
            <ChevronRight color="#94a3b8" />
          </button> : null}
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

      {/* Logout */}
      <div style={{ marginTop: 32, marginBottom: 16, padding: '0 4px' }}>
        <button
          onClick={onLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 20px', borderRadius: 14, border: '1.5px solid #fee2e2',
            background: '#fff5f5', cursor: 'pointer', color: '#ef4444',
            fontSize: 15, fontWeight: 600,
          }}
        >
          <LogOut size={20} color="#ef4444" />
          Sign out
        </button>
      </div>

      <ExportModal open={Boolean(exportFormat)} format={exportFormat || 'xlsx'} isAdmin={user.role === 'admin'} onClose={() => setExportFormat(null)} />
      
      {subscribeOpen && user.role === 'merchant' && merchantQuery.data?.data && (
        <SubscriptionModal merchant={merchantQuery.data.data} onClose={() => setSubscribeOpen(false)} onUpdate={() => merchantQuery.refetch()} />
      )}
      {paymentOpen && user.role === 'merchant' && user.merchant_id ? <PaymentSettingsModal merchantId={user.merchant_id} initial={paymentSettings.data?.data} onClose={() => setPaymentOpen(false)} onSaved={() => { void paymentSettings.refetch(); setPaymentOpen(false); }} /> : null}
    </div>
  );
}

function PaymentSettingsModal({ merchantId, initial, onClose, onSaved }: { merchantId: string; initial?: { upiId: string; displayName: string; paymentEnabled: boolean; mode: 'test' | 'live' }; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ upiId: initial?.upiId || '', displayName: initial?.displayName || '', paymentEnabled: initial?.paymentEnabled || false, mode: initial?.mode || 'test' });
  useEffect(() => { if (initial) setForm({ upiId: initial.upiId || '', displayName: initial.displayName || '', paymentEnabled: initial.paymentEnabled, mode: initial.mode || 'test' }); }, [initial]);
  const save = useMutation({ mutationFn: () => apiFetch(`/api/merchants/${merchantId}/payment-settings`, { method: 'PATCH', body: JSON.stringify(form) }), onSuccess: () => { showToast('Payment settings saved.'); onSaved(); }, onError: error => showToast(error.message, 'error') });
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={event => { event.preventDefault(); save.mutate(); }}><button type="button" className="icon-button modal-close" onClick={onClose}>×</button><h2>Payment &amp; UPI Settings</h2><p>Add the UPI ID that should receive customer payments.</p><div className="form-grid"><label>UPI ID<input value={form.upiId} onChange={event => setForm({ ...form, upiId: event.target.value })} placeholder="merchant@upi" /></label><label>Display name<input value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} placeholder="Your business name" /></label><label>Payment mode<select value={form.mode} onChange={event => setForm({ ...form, mode: event.target.value as 'test' | 'live' })}><option value="test">Test</option><option value="live">Live</option></select></label></div><label className="checkbox-row"><input type="checkbox" checked={form.paymentEnabled} onChange={event => setForm({ ...form, paymentEnabled: event.target.checked })} /> Enable customer UPI payments</label><p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Razorpay verification and webhook configuration are required before enabling live payments.</p><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={save.isPending}><Save size={16} />{save.isPending ? 'Saving…' : 'Save settings'}</button></div></form></div>;
}
