import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ScanLine, Tag, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { ErrorState, LoadingState, PageHeader } from '../components/Common';
import QrScanner from '../components/QrScanner';
import type { DashboardData, Offer, Pagination, Period, RewardSettings, UserProfile } from '../types';
import { dateInput, formatCurrency, formatPoints, rangeForPeriod } from '../utils';

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
  const [searchParams] = useSearchParams();
  const [scannerMode, setScannerMode] = useState<'redeem' | null>(searchParams.get('scan') === '1' ? 'redeem' : null);
  const [category, setCategory] = useState('');

  const dashboard = useDashboard('month', today, today);
  const data = dashboard.data || emptyDashboard;

  const offers = useQuery<{ offers: Offer[]; pagination: Pagination }>({
    queryKey: ['merchant-reward-offers'],
    queryFn: ({ signal }) => apiFetch(`/api/offers?page=1&pageSize=100`, { signal }),
    enabled: user.role === 'merchant',
  });
  const visibleOffers = (offers.data?.offers || []).filter((offer) => !category || (offer.category || 'General') === category);
  const categories = Array.from(new Set((offers.data?.offers || []).map((offer) => offer.category || 'General')));

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
              <strong>{formatPoints(data.summary.rewardPointsIssued)} pts</strong>
            </div>
            <div className="mobile-rewards-summary-item">
              <span>{t('dashboard.totalPointsRedeemed', 'Total Points Redeemed')}</span>
              <strong>{formatPoints(data.summary.totalPointsRedeemed || 0)} pts</strong>
            </div>
            <div className="mobile-rewards-summary-item liability">
              <span>{t('dashboard.pendingLiability', 'Pending Liability')}</span>
              <strong>{formatCurrency(data.summary.rewardPointsIssued)}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Offers catalogue */}
      <div className="mobile-section" style={{ marginTop: 24 }}>
        <div className="mobile-section-header">
          <h3>Offers</h3>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter offers by category">
            <option value="">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        {offers.isPending ? <LoadingState label="Loading offers" /> : offers.isError ? <ErrorState error={offers.error} retry={() => offers.refetch()} /> : (
          <div className="offer-grid">
            {visibleOffers.map((offer) => <article className="offer-card" key={offer.id}>
              {offer.imageUrl ? <img src={offer.imageUrl} alt="" /> : <div className="mobile-transaction-avatar"><Tag size={20} /></div>}
              <div><strong>{offer.title}</strong><p>{offer.description}</p><small>{offer.category || 'General'}</small></div>
            </article>)}
            {!visibleOffers.length ? <p className="muted">No offers in this category yet.</p> : null}
          </div>
        )}
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
