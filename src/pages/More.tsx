import { uiText } from '../uiText';
import { SIX_HOUR_LABELS } from '../utils';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronRight, FileSpreadsheet, Headset, LogOut, FileText, Settings, ShieldCheck, Mail, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { CustomDates, ExportModal, PageHeader, PeriodControl } from '../components/Common';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { MerchantFeedback } from '../components/MerchantFeedback';
import type { DashboardData, Period, UserProfile, Merchant } from '../types';
import { dateInput, formatCurrency, rangeForChartPeriod } from '../utils';

const emptyDashboard: DashboardData = {
  summary: { totalOrders: 0, totalRevenue: 0, rewardPointsIssued: 0, totalCustomers: 0 },
  intervals: SIX_HOUR_LABELS.map((label) => ({ label, orders: 0, revenue: 0 })),
  retention: { lifetimeCustomers: 0, selectedVisits: 0, todayVisits: 0, weekVisits: 0, monthVisits: 0 },
};

function useChartDashboard(period: Period, from: string, to: string) {
  const range = rangeForChartPeriod(period, from, to);
  const bucket = period === 'today' ? "six-hour" : period === 'month' ? "weekly" : "daily";
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
  const [supportOpen, setSupportOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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
      <PageHeader title={t('nav.more', 'More')} subtitle="" />

      {/* Account Settings & Exports */}
      <div className="mobile-section" style={{ marginTop: 24 }}>
        <div className="mobile-section-header">
          <h3>{uiText("Account & Tools")}</h3>
        </div>
        <div className="mobile-transactions" style={{ boxShadow: 'none', padding: 0 }}>
          {user.role === 'merchant' && <Link to="/merchant-profile" className="mobile-transaction-item" style={{ padding: '16px 0' }}><div className="mobile-transaction-avatar blue"><Settings size={20} /></div><div className="mobile-transaction-info"><h4>{uiText('Merchant Profile')}</h4><p>{uiText('Your business and account details')}</p></div><ChevronRight /></Link>}
          <button className="mobile-transaction-item" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }} onClick={() => setExportFormat('xlsx')}>
            <div className="mobile-transaction-avatar green" style={{ width: 40, height: 40 }}><FileSpreadsheet size={20} /></div>
            <div className="mobile-transaction-info" style={{ textAlign: 'left' }}>
              <h4>{uiText("Export to Excel")}</h4>
              <p>{uiText("Download full business reports")}</p>
            </div>
            <ChevronRight color="#94a3b8" />
          </button>
          
          <button className="mobile-transaction-item" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }} onClick={() => setExportFormat('pdf')}>
            <div className="mobile-transaction-avatar pink" style={{ width: 40, height: 40 }}><FileText size={20} /></div>
            <div className="mobile-transaction-info" style={{ textAlign: 'left' }}>
              <h4>{uiText("Export to PDF")}</h4>
              <p>{uiText("Download visual summaries")}</p>
            </div>
            <ChevronRight color="#94a3b8" />
          </button>

          <button className="mobile-transaction-item" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }} onClick={() => setSubscribeOpen(true)}>
            <div className="mobile-transaction-avatar blue" style={{ width: 40, height: 40 }}><ShieldCheck size={20} /></div>
            <div className="mobile-transaction-info" style={{ textAlign: 'left' }}>
              <h4>{uiText("Subscription")}</h4>
              <p>{uiText("Free trial · Subscriptions coming soon")}</p>
            </div>
            <ChevronRight color="#94a3b8" />
          </button>

          <Link to="/reward-settings" className="mobile-transaction-item" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '16px 0' }}>
            <div className="mobile-transaction-avatar" style={{ width: 40, height: 40, background: '#f1f5f9', color: '#64748b' }}><Settings size={20} /></div>
            <div className="mobile-transaction-info" style={{ textAlign: 'left' }}>
              <h4>{uiText("Reward Settings")}</h4>
              <p>{uiText("Configure points and expiry")}</p>
            </div>
            <ChevronRight color="#94a3b8" />
          </Link>
        </div>
      </div>

      {/* Help and Support */}
      {user.role === 'merchant' && <button type="button" className="mobile-help-btn" style={{ width: '100%', marginTop: 24, cursor: 'pointer' }} onClick={() => setFeedbackOpen(true)}><div className="mobile-help-btn-left"><MessageCircle size={20}/><div style={{ textAlign: 'left' }}><strong>{uiText("Feedback to AE")}</strong><p style={{ margin: '4px 0', fontSize: 12 }}>{uiText("Share suggestions or report an app issue")}</p></div></div><ChevronRight size={20}/></button>}
      <div className="mobile-help-support" style={{ marginTop: 24 }}>
        <p>{uiText("Need help?")}<br/>{uiText("Find quick answers or chat with our support team.")}</p>
        <button type="button" className="mobile-help-btn" style={{ width: '100%', cursor: 'pointer' }} aria-expanded={supportOpen} aria-controls="merchant-help-support" onClick={() => setSupportOpen(open => !open)}>
          <div className="mobile-help-btn-left">
            <Headset size={20} color="#64748b" />
            <span>{t('dashboard.helpSupport', 'Help & Support')}</span>
          </div>
          <ChevronRight size={20} color="#94a3b8" />
        </button>
        {supportOpen && <section id="merchant-help-support" className="panel" style={{ marginTop: 16, textAlign: 'left' }}>
          <h2>{uiText("Help &amp; Support")}</h2>
          <p>{uiText("Need assistance with your merchant account, points, QR scanning, or product lists? Chat with us on WhatsApp or email our support team.")}</p>
          <div className="form-actions" style={{ flexWrap: 'wrap', margin: '20px 0' }}>
            <a className="button whatsapp" href="https://wa.me/917306010846?text=Hello%20Affiliate%20AE%20support%2C%20I%20need%20help%20with%20my%20merchant%20account." target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/>{uiText("Chat on WhatsApp")}</a>
            <a className="button secondary" href="mailto:info@affiliateinnovations.co.in?subject=Merchant%20support"><Mail size={19}/>{uiText("Email Support")}</a>
          </div>
          <p style={{ overflowWrap: 'anywhere', color: 'var(--text-muted)' }}>{uiText("info@affiliateinnovations.co.in")}</p>
          <h3 style={{ marginTop: 24 }}>{uiText("Frequently Asked Questions")}</h3>
          {[
            ['How do I issue points to a customer?', 'Scan the customer’s My QR Code, select Issue Only, enter the purchase amount, check the points, and confirm the transaction.'],
            ['How do I redeem customer points?', 'Scan the customer’s Redeem QR Code to open Redeem + Issue. Redemption uses 100 points. Enter the purchase amount and discount, review the calculation, and confirm.'],
            ['Where can I change my reward settings?', 'Open More → Reward Settings, choose your earning rate and redemption discount, then select Save Settings.'],
            ['Where can I find purchase history?', 'Open Purchase History to review recorded transactions. Customer phone numbers are masked in the merchant view.'],
            ['What should I do if a transaction or QR scan fails?', 'Check your internet connection and review purchase history before retrying to avoid submitting the transaction twice. If you still need help, send support the time, order reference, and a screenshot. Never share passwords or OTPs.'],
            ['Is a subscription payment required now?', 'The pilot is free. Subscriptions are coming soon; no subscription payment is required during the free pilot.'],
          ].map(([question, answer]) => <details key={question} style={{ padding: '15px 0', borderBottom: '1px solid var(--border)' }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>{question}</summary><p style={{ marginTop: 10, lineHeight: 1.6, color: 'var(--text-muted)' }}>{answer}</p></details>)}
        </section>}
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
          <LogOut size={20} color="#ef4444" />{uiText(" Sign out ")}</button>
      </div>

      <div className="mobile-section"><Link className="button secondary" to="/privacy">{uiText("Privacy Policy")}</Link> <Link className="button secondary" to="/delete-account">{uiText("Delete account and data")}</Link></div>
      <ExportModal open={Boolean(exportFormat)} format={exportFormat || 'xlsx'} isAdmin={user.role === 'admin'} onClose={() => setExportFormat(null)} />
      {feedbackOpen && <MerchantFeedback onClose={() => setFeedbackOpen(false)}/>}
      
      {subscribeOpen && user.role === 'merchant' && merchantQuery.data?.data && (
        <SubscriptionModal merchant={merchantQuery.data.data} onClose={() => setSubscribeOpen(false)} onUpdate={() => merchantQuery.refetch()} />
      )}
    </div>
  );
}
