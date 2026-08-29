import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IndianRupee, CreditCard, Activity, Coins, CalendarClock, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { apiFetch } from '../api';
import { Merchant } from '../types';

interface MerchantWalletProps {
  merchant: Merchant;
  onUpdate: () => void;
}

export default function MerchantWallet({ merchant, onUpdate }: MerchantWalletProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
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
      
      const res = await loadRazorpay();
      if (!res) throw new Error('Razorpay SDK failed to load. Are you online?');

      const { data: subscription } = await apiFetch<any>(`/api/payments/create-subscription`, {
        method: 'POST',
        body: JSON.stringify({ merchant_id: merchant.id })
      });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE',
        subscription_id: subscription.id,
        name: 'Sharon Rewards',
        description: 'Monthly Dashboard Access & Points',
        handler: async function (response: any) {
          try {
            await apiFetch(`/api/merchants/${merchant.id}/subscription`, {
              method: 'POST',
              body: JSON.stringify({
                payment_reference: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                mandate_id: response.razorpay_subscription_id
              })
            });
            onUpdate();
          } catch (err: any) {
            setError(err.message || 'Payment verification failed');
          }
        },
        theme: { color: '#6366f1' }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setError(response.error.description || 'Payment failed');
      });
      rzp.open();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payment');
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    if (topUpAmount < 50) {
      setError('Minimum top-up is ₹50');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      const payment_reference = `topup_${Date.now()}`;
      await apiFetch(`/api/merchants/${merchant.id}/top-up`, {
        method: 'POST',
        body: JSON.stringify({ points: topUpAmount, payment_reference })
      });
      onUpdate();
      setTopUpAmount(50);
      setShowTopUp(false);
    } catch (err: any) {
      setError(err.message || 'Failed to top up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
      
      {/* Mini Wallet Box */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        background: 'var(--bg-inset)', 
        border: '1px solid var(--border)',
        padding: '6px 16px',
        borderRadius: '24px',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: '600' }}>
          <Coins size={16} style={{ color: 'var(--accent-vibrant, #f59e0b)' }} />
          <span>{currentPoints} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>Pts</span></span>
        </div>

        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }}></div>

        {isExpired ? (
           <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--error)', fontSize: '0.85rem', fontWeight: '500' }}>
             <Activity size={14} />
             <span>Inactive</span>
           </div>
        ) : (
           <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.85rem', fontWeight: '500' }}>
             <CheckCircle2 size={14} />
             <span>Active</span>
           </div>
        )}
      </div>

      {/* Action Button */}
      {isExpired ? (
        <button 
          className="button primary" 
          onClick={handlePurchaseSubscription}
          disabled={loading}
          style={{ padding: '6px 16px', height: '36px', display: 'flex', gap: '6px', borderRadius: '24px' }}
        >
          <CalendarClock size={16} />
          {loading ? '...' : 'Setup AutoPay'}
        </button>
      ) : (
        <button 
          className="button secondary" 
          onClick={() => setShowTopUp(!showTopUp)}
          style={{ padding: '6px 16px', height: '36px', display: 'flex', gap: '6px', borderRadius: '24px', position: 'relative' }}
        >
          <IndianRupee size={14} />
          Top Up
        </button>
      )}

      {/* Top Up Popover */}
      {showTopUp && !isExpired && (
        <div style={{ 
          position: 'absolute', 
          top: 'calc(100% + 10px)', 
          right: 0, 
          background: 'var(--bg-panel)', 
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          zIndex: 100,
          width: '260px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>Top Up Points</h4>
            <button onClick={() => setShowTopUp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input 
              type="number"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(parseInt(e.target.value) || 0)}
              min={50}
              className="input-field"
              style={{ flex: 1, padding: '8px' }}
            />
          </div>
          
          <button 
            className="button primary"
            onClick={handleTopUp}
            disabled={loading || topUpAmount < 50}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? 'Processing...' : `Pay ₹${topUpAmount}`}
          </button>
        </div>
      )}

      {/* Error Message Tooltip */}
      {error && (
        <div style={{ 
          position: 'absolute', 
          top: 'calc(100% + 5px)', 
          right: '0', 
          color: 'var(--error)', 
          background: 'var(--bg-panel)', 
          border: '1px solid var(--error)',
          padding: '8px 12px', 
          borderRadius: '6px', 
          fontSize: '0.8rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap',
          zIndex: 50
        }}>
          {error}
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', marginLeft: '8px', cursor: 'pointer' }}><X size={12} /></button>
        </div>
      )}
    </div>
  );
}
