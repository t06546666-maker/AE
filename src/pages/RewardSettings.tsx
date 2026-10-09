import { uiText } from '../uiText';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, BadgeIndianRupee, ChartNoAxesCombined, CheckCircle2, Coins, Gift, Info, MessageCircle, RefreshCw, Save, ShoppingBasket, ShoppingCart, Star, Tag, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import { ErrorState, LoadingState, PageHeader } from '../components/Common';
import type { RewardSettings, UserProfile } from '../types';
import { formatPoints } from '../utils';
import { useToast } from '../toast';
import './reward-settings.css';

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
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [flatDiscount, setFlatDiscount] = useState('50');
  const [earnOptions, setEarnOptions] = useState('5, 10, 20, 30, 50');
  const [subscription, setSubscription] = useState({ price: 200, points: 10000, days: 30 });
  const [plans, setPlans] = useState([
    { id: 'standard', name: 'Standard', monthly: 200, yearly: 2000, points: 10000, days: 30 },
    { id: 'pro', name: 'Pro', monthly: 499, yearly: 4990, points: 30000, days: 30 },
    { id: 'premium', name: 'Premium', monthly: 999, yearly: 9990, points: 75000, days: 30 },
  ]);

  useEffect(() => { 
    if (settings.data) { 
      setEarnPoints(settings.data.merchantEarnPoints ?? 10);
      setRedeemDiscount(settings.data.merchantRedeemDiscount ?? 5);
      setDiscountType(settings.data.merchantDiscountType ?? 'percentage');
      setFlatDiscount(String(settings.data.merchantFlatDiscount ?? 50));
      if (settings.data.earnOptions) setEarnOptions(settings.data.earnOptions.join(', '));
      if (settings.data.subscription) setSubscription(settings.data.subscription);
      if (settings.data.subscription?.plans) setPlans(settings.data.subscription.plans);
    } 
  }, [settings.data]);
  
  const saveMerchant = useMutation({ 
    mutationFn: () => apiFetch(`/api/merchants/${user.merchant_id}/reward-settings`, { 
      method: 'PUT', 
      body: JSON.stringify({ earn_points_per_100: earnPoints, redeem_discount_per_100: redeemDiscount, redeem_discount_type: discountType, redeem_flat_amount: Number(flatDiscount) })
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
        subscription: { ...subscription, plans },
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

  if (user.role === 'merchant') return (
    <div className="rs-page">
      <section className="rs-card">
        <header className="rs-hero"><span className="rs-hero-icon"><Gift /></span><div><h1>{uiText("Reward Settings")}</h1><p>{uiText("Set how customers earn points and how they can redeem them at your store.")}</p></div></header>
        <div className="rs-settings">
          <div className="rs-field"><span className="rs-icon blue"><Coins /></span><label><strong>{uiText("Points given per ₹100 purchase")}</strong><span>{uiText("How many points a customer earns for every ₹100 spent.")}</span><select value={earnPoints} onChange={e => setEarnPoints(Number(e.target.value))}>{Array.from(new Set([...(data?.earnOptions || []), earnPoints])).map(option => <option key={option} value={option}>{option}{uiText(" Points")}</option>)}</select></label><Info className="rs-info" aria-label={uiText("Points are capped at 100 per purchase")} /></div>
          <div className="rs-field"><span className="rs-icon purple"><Tag /></span><label><strong>{uiText("Discount given per 100 points redeemed")}</strong><span>{uiText("How much discount customers get for every 100 points.")}</span><select aria-label={uiText("Discount type")} value={discountType} onChange={e => setDiscountType(e.target.value as 'percentage' | 'flat')}><option value="percentage">{uiText("Percentage (%)")}</option><option value="flat">{uiText("Flat Rupees (₹)")}</option></select>{discountType === 'flat' ? <><span>{uiText("Flat discount amount (₹)")}</span><input type="number" min="0" max="1000000" step="0.01" value={flatDiscount} onChange={e => setFlatDiscount(e.target.value)} aria-label={uiText("Flat discount amount in rupees")}/></> : <select value={redeemDiscount} onChange={e => setRedeemDiscount(Number(e.target.value))}>{Array.from(new Set([...(data?.redeemOptions || []), redeemDiscount])).map(option => <option key={option} value={option}>{option}{uiText("% Discount")}</option>)}</select>}</label><Info className="rs-info" aria-label={uiText("Redemption uses exactly 100 points")} /></div>
          <aside className="rs-notice"><Star size={25} fill="currentColor"/><div><strong>{uiText("Maximum 100 points can be applied in a single bill.")}</strong><p>{uiText("Customers can earn and redeem points over time. Redemption uses exactly 100 points per transaction.")}</p></div></aside>
        </div>
      </section>
      <section className="rs-card rs-examples"><header><span className="rs-icon green"><ChartNoAxesCombined /></span><div><h2>{uiText("Earning Examples")}</h2><p>{uiText("Based on ")}{earnPoints}{uiText(" points per ₹100 purchase (maximum 100 points per bill)")}</p></div></header><div className="rs-grid">{[100, 250, 1000].map(amount => <div className="rs-example earning" key={amount}><strong><ShoppingBasket />₹{amount.toLocaleString('en-IN')}{uiText(" Purchase")}</strong><ArrowDown className="rs-down"/><b><span className="rs-coin">★</span>{Math.min(100, Math.floor(amount / 100 * earnPoints))}{uiText(" Points")}</b></div>)}</div></section>
      <section className="rs-card rs-examples"><header><span className="rs-icon purple"><Tag /></span><div><h2>{uiText("Redemption Examples")}</h2><p>{uiText("Based on ")}{discountType === 'flat' ? `₹${Number(flatDiscount || 0).toFixed(2)} flat discount` : `${redeemDiscount}% discount`}{uiText(" per 100 points (fixed 100 points per bill)")}</p></div></header><div className="rs-grid">{[1000, 500, 250].map(amount => <div className="rs-example redemption" key={amount}><strong><Coins />{uiText("100 Points")}</strong><ArrowDown className="rs-down"/><b>{discountType === 'flat' ? `₹${Number(flatDiscount || 0).toFixed(2)} Flat` : `${redeemDiscount}% Discount`}</b><div className="rs-example-total"><span><ShoppingCart size={18}/>{uiText("On a ₹")}{amount.toLocaleString('en-IN')}{uiText(" order")}</span><b>₹{Math.min(amount, discountType === 'flat' ? Number(flatDiscount || 0) : amount * redeemDiscount / 100).toFixed(2)}{uiText(" off")}</b></div></div>)}</div></section>
      <section className="rs-card rs-rules"><h2><TriangleAlert/>{uiText("Important Rules")}</h2><div className="rs-rule-grid"><p><CheckCircle2 className="green"/>{uiText("Exactly 100 points are redeemed in one bill.")}</p><p><Gift className="purple"/>{uiText("Discount is calculated from the purchase amount entered at checkout.")}</p><p><RefreshCw className="blue"/>{uiText("Points can be earned and used across multiple transactions.")}</p><p><Info className="amber"/>{uiText("You can change these settings anytime.")}</p></div></section>
      <button className="rs-save" type="button" disabled={saveMerchant.isPending || !flatDiscount.trim() || !Number.isFinite(Number(flatDiscount)) || Number(flatDiscount) < 0 || Number(flatDiscount) > 1000000} onClick={() => saveMerchant.mutate()}><Save/>{saveMerchant.isPending ? uiText("Saving…") : uiText("Save Settings")}</button>
    </div>
  );

  return (
    <>
      <PageHeader title={t('reward.title', 'Reward Settings')} subtitle={t('reward.subtitle', 'Configure point rules')} />
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('reward.rules', 'Reward Rules')}</h2>
            <p>{uiText("Configure earning and redemption rates")}</p>
          </div>
          <BadgeIndianRupee />
        </div>
        
        {user.role === 'admin' ? (
          <div className="settings-fields">
            <label>{uiText("Points options per ₹100 purchase")}<input value={earnOptions} onChange={(e) => setEarnOptions(e.target.value)} placeholder="5, 10, 20" /></label>
            <label>{uiText("Subscription price (₹)")}<input type="number" min="1" value={subscription.price} onChange={(e) => setSubscription({ ...subscription, price: Number(e.target.value) })} /></label>
            <label>{uiText("Points added per subscription")}<input type="number" min="1" value={subscription.points} onChange={(e) => setSubscription({ ...subscription, points: Number(e.target.value) })} /></label>
            <label>{uiText("Subscription duration (days)")}<input type="number" min="1" value={subscription.days} onChange={(e) => setSubscription({ ...subscription, days: Number(e.target.value) })} /></label>
            <div style={{ overflowX: 'auto' }}>
              <h4 style={{ marginBottom: 8 }}>{uiText("Subscription plan grid")}</h4>
              <table style={{ width: '100%', minWidth: 620 }}><thead><tr><th>{uiText("Plan")}</th><th>{uiText("Monthly ₹")}</th><th>{uiText("Yearly ₹")}</th><th>{uiText("Points")}</th><th>{uiText("Days")}</th></tr></thead><tbody>
                {plans.map((plan, index) => <tr key={plan.id}>
                  <td><input value={plan.name} onChange={(e) => setPlans(plans.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} /></td>
                  <td><input type="number" min="0" value={plan.monthly} onChange={(e) => setPlans(plans.map((item, i) => i === index ? { ...item, monthly: Number(e.target.value) } : item))} /></td>
                  <td><input type="number" min="0" value={plan.yearly} onChange={(e) => setPlans(plans.map((item, i) => i === index ? { ...item, yearly: Number(e.target.value) } : item))} /></td>
                  <td><input type="number" min="0" value={plan.points} onChange={(e) => setPlans(plans.map((item, i) => i === index ? { ...item, points: Number(e.target.value) } : item))} /></td>
                  <td><input type="number" min="1" value={plan.days} onChange={(e) => setPlans(plans.map((item, i) => i === index ? { ...item, days: Number(e.target.value) } : item))} /></td>
                </tr>)}
              </tbody></table>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>{uiText("These values apply to new merchant subscriptions and the point choices shown to merchants.")}</p>
            <button className="button primary" disabled={saveAdmin.isPending} onClick={() => saveAdmin.mutate()}><Save size={16} />{saveAdmin.isPending ? uiText("Saving...") : uiText("Save Admin Settings")}</button>
          </div>
        ) : (
          <>
            <div className="settings-fields">
              <label>{uiText(" Points given per ₹100 purchase ")}<select value={earnPoints} onChange={(e) => setEarnPoints(Number(e.target.value))}>
                  {data?.earnOptions.map((option) => (
                    <option key={option} value={option}>{option}{uiText(" Points")}</option>
                  ))}
                </select>
              </label>
              
              <label>{uiText(" Discount given per 100 points redeemed ")}<select value={redeemDiscount} onChange={(e) => setRedeemDiscount(Number(e.target.value))}>
                  {data?.redeemOptions.map((option) => (
                    <option key={option} value={option}>{option}{uiText("% Discount")}</option>
                  ))}
                </select>
              </label>
              
              <div className="settings-example" style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-inset)', borderRadius: '8px' }}>
                <strong style={{ display: 'block', marginBottom: '10px' }}>{uiText("Earning Example:")}</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>{uiText("₹250 Purchase")}</span>
                  <strong>{Math.floor(250 / 100 * earnPoints)}{uiText(" Points")}</strong>
                </div>
                <hr style={{ margin: '15px 0', borderColor: 'var(--border)' }} />
                <strong style={{ display: 'block', marginBottom: '10px' }}>{uiText("Redemption Example:")}</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>{uiText("200 Points Redeemed")}</span>
                  <strong>{200 / 100 * redeemDiscount}{uiText("% Discount")}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{uiText("On a ₹1,000 order")}</span>
                  <strong>-₹{formatPoints(1000 * ((200 / 100 * redeemDiscount) / 100))}{uiText(" off")}</strong>
                </div>
              </div>
            </div>
            
            <button 
              className="button primary" 
              disabled={saveMerchant.isPending} 
              onClick={() => saveMerchant.mutate()}
            >
              <Save size={16} />
              {saveMerchant.isPending ? uiText("Saving...") : uiText("Save Settings")}
            </button>
          </>
        )}
      </section>
      
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{t('reward.receipt', 'Monthly Subscription')}</h2>
            <p>{uiText("Maximum 5,000 points can be issued per month.")}</p>
          </div>
          <MessageCircle />
        </div>
      </section>
    </>
  );
}
