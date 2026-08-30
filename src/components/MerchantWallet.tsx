import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IndianRupee, CreditCard, Activity, Coins, CalendarClock, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../api';
import { Merchant } from '../types';

interface MerchantWalletProps {
  merchant: Merchant;
  onUpdate: () => void;
}

export default function MerchantWallet({ merchant, onUpdate }: MerchantWalletProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(50);
  const [error, setError] = useState<string>('');

  const currentPoints = merchant.point_balance || 0;
  
  // Check if subscription is expired or missing
  const now = new Date();
  const expiryDate = merchant.subscription_expires_at ? new Date(merchant.subscription_expires_at) : null;
  const isExpired = !expiryDate || expiryDate < now;
  const hasMandate = !!merchant.subscription_mandate_id;

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePurchaseSubscription = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 1. Load Razorpay script
      const res = await loadRazorpay();
      if (!res) {
        throw new Error('Razorpay SDK failed to load. Are you online?');
      }

      // 2. Create subscription in backend
      const { data: subscription } = await apiFetch<any>(`/api/payments/create-subscription`, {
        method: 'POST',
        body: JSON.stringify({ merchant_id: merchant.id })
      });

      // 3. Open Razorpay Checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE', // Replace with your key
        subscription_id: subscription.id,
        name: 'Sharon Rewards',
        description: 'Monthly Dashboard Access & Points',
        handler: async function (response: any) {
          try {
            // 4. Verify & save on backend
            await apiFetch(`/api/merchants/${merchant.id}/subscription`, {
              method: 'POST',
              body: JSON.stringify({
                payment_reference: response.razorpay_payment_id,
                mandate_id: response.razorpay_subscription_id,
                signature: response.razorpay_signature
              })
            });
            onUpdate();
          } catch (err: any) {
            setError(err.message || 'Payment verification failed');
          }
        },
        prefill: {
          name: merchant.name,
          email: merchant.email,
          contact: merchant.phone
        },
        theme: {
          color: '#3399cc'
        }
      };
      
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setError(response.error.description || 'Payment failed');
      });
      rzp.open();

    } catch (err: any) {
      setError(err.message || 'Failed to setup subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    if (topUpAmount < 50) {
      setError('Minimum top-up is 50 points (₹50)');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      // In a real app, this would integrate with Razorpay one-time checkout
      const payment_reference = `topup_${Date.now()}`;
      await apiFetch(`/api/merchants/${merchant.id}/top-up`, {
        method: 'POST',
        body: JSON.stringify({ points: topUpAmount, payment_reference })
      });
      onUpdate();
      setTopUpAmount(50); // reset after success
    } catch (err: any) {
      setError(err.message || 'Failed to top up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ border: '1px solid var(--border)', padding: '24px', borderRadius: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--accent)', color: 'var(--primary)', padding: '12px', borderRadius: '50%' }}>
          <Coins size={24} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>Merchant Wallet & Access</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Manage your dashboard subscription and point balance</p>
        </div>
      </div>

      <div style={{ 
        background: 'var(--bg-inset)', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Balance</span>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentPoints} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>Points</span>
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Subscription Status</span>
          {isExpired ? (
             <div style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
               <Activity size={16} />
               <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>Expired / Inactive</span>
             </div>
          ) : (
             <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
               <CheckCircle2 size={16} />
               <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                 Active until {expiryDate?.toLocaleDateString()}
               </span>
             </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--error)', background: 'var(--error-light)', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {isExpired ? (
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--error)', padding: '20px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--error)' }}>Dashboard Access Locked</h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
            Your monthly subscription is inactive. Set up AutoPay for ₹200/month to restore dashboard access. Each renewal grants you 100 reward points!
          </p>
          <button 
            className="btn btn-primary" 
            onClick={handlePurchaseSubscription}
            disabled={loading}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', padding: '12px' }}
          >
            <CalendarClock size={18} />
            {loading ? 'Setting up AutoPay...' : 'Setup AutoPay (₹200/mo)'}
          </button>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h4 style={{ margin: '0 0 8px 0' }}>Top Up Points</h4>
              <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                Purchase more points to continue issuing rewards to your customers. (1 Point = ₹1)
              </p>
            </div>
            {hasMandate && (
              <span style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                AutoPay Active
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <IndianRupee size={16} />
              </div>
              <input 
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(parseInt(e.target.value) || 0)}
                min={50}
                disabled={loading}
                className="input-field"
                style={{ width: '100%', padding: '10px 10px 10px 36px', height: '100%', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
            <button 
              className="btn btn-secondary"
              onClick={handleTopUp}
              disabled={loading || topUpAmount < 50}
              style={{ whiteSpace: 'nowrap', padding: '0 20px' }}
            >
              <CreditCard size={16} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
              {loading ? '...' : `Pay ₹${topUpAmount}`}
            </button>
          </div>
          {topUpAmount < 50 && (
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--error)' }}>Minimum top-up is ₹50.</p>
          )}
        </div>
      )}
    </div>
  );
}
