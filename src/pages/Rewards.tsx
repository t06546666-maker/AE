import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Gift, ScanLine, Tag, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { ErrorState, LoadingState, PageHeader } from '../components/Common';
import QrScanner from '../components/QrScanner';
import type { DashboardData, Period, RewardSettings, UserProfile } from '../types';
import { dateInput, formatCurrency, rangeForPeriod } from '../utils';

const emptyDashboard: DashboardData = {
  summary: { totalOrders: 0, totalRevenue: 0, rewardPointsIssued: 0, totalCustomers: 0 },
  intervals: [],
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

export function Rewards({ user }: { user: UserProfile }) {
  const { t } = useTranslation();
  const today = dateInput();
  const [scannerMode, setScannerMode] = useState<'redeem' | null>(null);

  const dashboard = useDashboard('month', today, today);
  const data = dashboard.data || emptyDashboard;

  const settings = useQuery({
    queryKey: ['reward-settings'],
    queryFn: ({ signal }) => apiFetch<RewardSettings>('/api/settings/reward', { signal }),
    enabled: user.role === 'merchant' && Boolean(scannerMode),
  });

  return (
    <div className="mobile-dashboard-wrapper" style={{ paddingBottom: '80px' }}>
      <PageHeader title={t('nav.rewards', 'Rewards')} subtitle="Manage points and offers" />

      {/* Main Action - Redeem */}
      <button className="mobile-main-action" style={{ marginTop: 16 }} onClick={() => setScannerMode('redeem')}>
        <div className="mobile-main-action-content">
          <div className="mobile-main-action-icon"><ScanLine /></div>
          <div className="mobile-main-action-text">
            <h2>Redeem Points</h2>
            <p>Scan customer QR</p>
          </div>
        </div>
        <ChevronRight color="white" opacity={0.8} />
      </button>

      {/* Rewards Summary */}
      <div className="mobile-panel" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14, marginBottom: 16 }}>{t('dashboard.rewardsSummary', 'Rewards Summary')} (This Month)</h3>
        {dashboard.isPending ? <LoadingState label="Loading" /> : (
          <div className="mobile-rewards-summary">
            <div className="mobile-rewards-summary-item">
              <span>{t('dashboard.totalPointsIssued', 'Total Points Issued')}</span>
              <strong>{formatCurrency(data.summary.rewardPointsIssued)} pts</strong>
            </div>
            <div className="mobile-rewards-summary-item">
              <span>{t('dashboard.totalPointsRedeemed', 'Total Points Redeemed')}</span>
              <strong>0 pts</strong> {/* Note: the API doesn't expose redeemed yet in DashboardData, mocking for UI demo as requested */}
            </div>
            <div className="mobile-rewards-summary-item liability">
              <span>{t('dashboard.pendingLiability', 'Pending Liability')}</span>
              <strong>₹{formatCurrency(data.summary.rewardPointsIssued)}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Offers Link */}
      <div className="mobile-section" style={{ marginTop: 24 }}>
        <div className="mobile-section-header">
          <h3>Promotions & Offers</h3>
        </div>
        <div className="mobile-transactions" style={{ boxShadow: 'none', padding: 0 }}>
          <Link to="/offers" className="mobile-transaction-item" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '16px 0' }}>
            <div className="mobile-transaction-avatar" style={{ width: 40, height: 40, background: '#f59e0b', color: '#fff' }}><Tag size={20} /></div>
            <div className="mobile-transaction-info" style={{ textAlign: 'left' }}>
              <h4>Manage Offers</h4>
              <p>Create WhatsApp campaigns</p>
            </div>
            <ChevronRight color="#94a3b8" />
          </Link>
        </div>
      </div>
      
      {/* Create Offers Banner */}
      <div className="mobile-create-offer-banner" style={{ marginTop: 16 }}>
        <div className="mobile-create-offer-text">
          <h4>{t('dashboard.createOffersBannerTitle', 'Create offers and attract more customers')}</h4>
          <Link to="/offers" className="mobile-create-offer-btn">{t('dashboard.createOfferBtn', 'Create Offer')}</Link>
        </div>
        <Gift size={64} color="#f59e0b" style={{ opacity: 0.8 }} />
      </div>

      {/* Scanner Modal */}
      {Boolean(scannerMode) ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setScannerMode(null); }}>
          <div className="modal scanner-modal" role="dialog" aria-modal="true" aria-label="Redeem Points">
            <button type="button" className="icon-button modal-close" title={t('common.close')} onClick={() => setScannerMode(null)}><X /></button>
            {settings.isPending ? <LoadingState label={`${t('common.loading')} scanner`} /> : null}
            {settings.isError ? <ErrorState error={settings.error} retry={() => settings.refetch()} /> : null}
            {settings.data ? <QrScanner settings={settings.data} mode={scannerMode as any} merchantId={user.merchant_id || undefined} autoStart /> : null}
          </div>
        </div>
      ) : null}

    </div>
  );
}
