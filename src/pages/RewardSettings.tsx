import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeIndianRupee, MessageCircle, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import { ErrorState, LoadingState, PageHeader } from '../components/Common';
import type { RewardSettings, UserProfile } from '../types';
import { formatPoints } from '../utils';
import { useToast } from '../toast';

export function RewardSettingsPage({ user }: { user: UserProfile }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  
  const settings = useQuery({ 
    queryKey: ['reward-settings'], 
    queryFn: ({ signal }) => apiFetch<RewardSettings>('/api/settings/reward', { signal }) 
  });
  
  const [earnPoints, setEarnPoints] = useState(10);
  const [redeemDiscount, setRedeemDiscount] = useState(5);
  const [earnOptions, setEarnOptions] = useState('5, 10, 20, 30, 50');
  const [subscription, setSubscription] = useState({ price: 200, points: 10000, days: 30 });

  useEffect(() => { 
    if (settings.data) { 
      setEarnPoints(settings.data.merchantEarnPoints || 10);
      setRedeemDiscount(settings.data.merchantRedeemDiscount || 5);
      if (settings.data.earnOptions) setEarnOptions(settings.data.earnOptions.join(', '));
      if (settings.data.subscription) setSubscription(settings.data.subscription);
    } 
  }, [settings.data]);
  
  const saveMerchant = useMutation({ 
    mutationFn: () => apiFetch(`/api/merchants/${user.merchant_id}/reward-settings`, { 
      method: 'PUT', 
      body: JSON.stringify({ earn_points_per_100: earnPoints, redeem_discount_per_100: redeemDiscount }) 
    }), 
    onSuccess() { 
      queryClient.invalidateQueries({ queryKey: ['reward-settings'] }); 
      showToast(t('reward.saved', 'Settings saved')); 
    }, 
    onError(error: Error) { 
      showToast(error.message, 'error'); 
    } 
  });

  const saveAdmin = useMutation({
    mutationFn: () => apiFetch('/api/settings/reward', {
      method: 'PUT',
      body: JSON.stringify({
        earnOptions: earnOptions.split(',').map(value => Number(value.trim())).filter(value => Number.isFinite(value) && value > 0),
        subscription,
      }),
    }),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['reward-settings'] });
      showToast('Admin settings saved');
    },
    onError(error: Error) { showToast(error.message, 'error'); },
  });

  if (settings.isPending) return <LoadingState />;
  if (settings.isError) return <ErrorState error={settings.error} retry={() => settings.refetch()} />;
  
  const data = settings.data;

  return (
    <>
      <PageHeader title={t('reward.title', 'Reward Settings')} subtitle={t('reward.subtitle', 'Configure point rules')} />
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('reward.rules', 'Reward Rules')}</h2>
            <p>Configure earning and redemption rates</p>
          </div>
          <BadgeIndianRupee />
        </div>
        
        {user.role === 'admin' ? (
          <div className="settings-fields">
            <label>Points options per ₹100 purchase<input value={earnOptions} onChange={(e) => setEarnOptions(e.target.value)} placeholder="5, 10, 20" /></label>
            <label>Subscription price (₹)<input type="number" min="1" value={subscription.price} onChange={(e) => setSubscription({ ...subscription, price: Number(e.target.value) })} /></label>
            <label>Points added per subscription<input type="number" min="1" value={subscription.points} onChange={(e) => setSubscription({ ...subscription, points: Number(e.target.value) })} /></label>
            <label>Subscription duration (days)<input type="number" min="1" value={subscription.days} onChange={(e) => setSubscription({ ...subscription, days: Number(e.target.value) })} /></label>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>These values apply to new merchant subscriptions and the point choices shown to merchants.</p>
            <button className="button primary" disabled={saveAdmin.isPending} onClick={() => saveAdmin.mutate()}><Save size={16} />{saveAdmin.isPending ? 'Saving...' : 'Save Admin Settings'}</button>
          </div>
        ) : (
          <>
            <div className="settings-fields">
              <label>
                Points given per ₹100 purchase
                <select value={earnPoints} onChange={(e) => setEarnPoints(Number(e.target.value))}>
                  {data?.earnOptions.map((option) => (
                    <option key={option} value={option}>{option} Points</option>
                  ))}
                </select>
              </label>
              
              <label>
                Discount given per 100 points redeemed
                <select value={redeemDiscount} onChange={(e) => setRedeemDiscount(Number(e.target.value))}>
                  {data?.redeemOptions.map((option) => (
                    <option key={option} value={option}>{option}% Discount</option>
                  ))}
                </select>
              </label>
              
              <div className="settings-example" style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-inset)', borderRadius: '8px' }}>
                <strong style={{ display: 'block', marginBottom: '10px' }}>Earning Example:</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>₹250 Purchase</span>
                  <strong>{Math.floor(250 / 100 * earnPoints)} Points</strong>
                </div>
                <hr style={{ margin: '15px 0', borderColor: 'var(--border)' }} />
                <strong style={{ display: 'block', marginBottom: '10px' }}>Redemption Example:</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>200 Points Redeemed</span>
                  <strong>{200 / 100 * redeemDiscount}% Discount</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>On a ₹1,000 order</span>
                  <strong>-₹{formatPoints(1000 * ((200 / 100 * redeemDiscount) / 100))} off</strong>
                </div>
              </div>
            </div>
            
            <button 
              className="button primary" 
              disabled={saveMerchant.isPending} 
              onClick={() => saveMerchant.mutate()}
            >
              <Save size={16} />
              {saveMerchant.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </>
        )}
      </section>
      
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{t('reward.receipt', 'Monthly Subscription')}</h2>
            <p>Maximum 5,000 points can be issued per month.</p>
          </div>
          <MessageCircle />
        </div>
      </section>
    </>
  );
}
