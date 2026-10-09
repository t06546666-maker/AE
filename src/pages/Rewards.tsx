import { uiText } from '../uiText';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from '../components/Common';
import QrScanner from '../components/QrScanner';
import type { RewardSettings, UserProfile } from '../types';

// Open the scanner directly, without a rewards/offers landing page.
export function Rewards({ user }: { user: UserProfile }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const closeScanner = () => navigate('/dashboard', { replace: true });
  const settings = useQuery({
    queryKey: ['reward-settings'],
    queryFn: ({ signal }) => apiFetch<RewardSettings>('/api/settings/reward', { signal }),
    enabled: user.role === 'merchant',
  });
  if (user.role !== 'merchant') return <Navigate to="/dashboard" replace />;
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeScanner(); }}>
    <div className="modal scanner-modal" role="dialog" aria-modal="true" aria-label={uiText("Scan customer QR")}>
      <button type="button" className="icon-button modal-close" aria-label={t('common.close')} onClick={closeScanner}><X /></button>
      {settings.isPending && <LoadingState label="Loading scanner" />}
      {settings.isError && <ErrorState error={settings.error} retry={() => settings.refetch()} />}
      {settings.data && <QrScanner settings={settings.data} mode="redeem" merchantId={user.merchant_id || undefined} autoStart onDone={closeScanner} />}
    </div>
  </div>;
}
