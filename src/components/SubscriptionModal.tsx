import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, X as XIcon, Loader2 } from 'lucide-react';
import { Merchant } from '../types';
import { apiFetch } from '../api';

interface SubscriptionModalProps {
  merchant: Merchant;
  onClose: () => void;
  onUpdate: () => void;
}

export function SubscriptionModal({ merchant, onClose, onUpdate }: SubscriptionModalProps) {
  const { t } = useTranslation();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      if (!res) {
        throw new Error('Razorpay SDK failed to load. Are you online?');
      }

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
                mandate_id: response.razorpay_subscription_id,
                signature: response.razorpay_signature
              })
            });
            onUpdate();
            onClose();
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
          color: '#F59E0B'
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

  const features = [
    { name: 'Unlimited Customer Profiles', standard: true, pro: true, premium: true },
    { name: 'QR Code Checkouts', standard: true, pro: true, premium: true },
    { name: 'Analytics Dashboard', standard: true, pro: true, premium: true },
    { name: 'Priority WhatsApp Marketing', standard: false, pro: true, premium: true },
    { name: 'Custom Branding', standard: false, pro: false, premium: true },
    { name: 'Multi-Store Access', standard: false, pro: false, premium: true },
  ];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ zIndex: 1100 }}>
      <div className="modal" style={{ width: '90%', maxWidth: '800px', padding: '40px 20px', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
        <button type="button" className="icon-button modal-close" title="Close" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16 }}><X /></button>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Our Subscription Plans</h2>
          <p style={{ color: 'var(--text-muted)' }}>Choose the plan that best fits your business needs. Upgrade anytime.</p>
        </div>

        {error && <div className="error-message" style={{ marginBottom: 20 }}>{error}</div>}

        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: 'var(--bg-inset)', padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 'bold' }}>Package Details</div>
            <div style={{ textAlign: 'center', fontWeight: 'bold' }}>Standard</div>
            <div style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)' }}>Pro</div>
            <div style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)' }}>Premium</div>
          </div>

          {/* Feature Rows */}
          {features.map((feature, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div style={{ color: 'var(--text-main)' }}>{feature.name}</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {feature.standard ? <Check size={20} color="#10b981" /> : <XIcon size={20} color="#ef4444" />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', opacity: 0.5 }}>
                {feature.pro ? <Check size={20} color="#10b981" /> : <XIcon size={20} color="#ef4444" />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', opacity: 0.5 }}>
                {feature.premium ? <Check size={20} color="#10b981" /> : <XIcon size={20} color="#ef4444" />}
              </div>
            </div>
          ))}

          {/* Pricing Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '24px 16px', alignItems: 'center', background: 'var(--bg-inset)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: billing === 'monthly' ? 'bold' : 'normal' }}>Monthly</span>
              <div 
                style={{ width: '40px', height: '24px', background: 'var(--primary)', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}
                onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
              >
                <div style={{ 
                  width: '18px', height: '18px', background: 'white', borderRadius: '50%', 
                  position: 'absolute', top: '3px', left: billing === 'monthly' ? '3px' : '19px',
                  transition: 'left 0.2s'
                }} />
              </div>
              <span style={{ fontWeight: billing === 'yearly' ? 'bold' : 'normal' }}>Yearly</span>
            </div>
            
            <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
              ₹{billing === 'monthly' ? '200' : '2000'}
            </div>
            <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
              ₹{billing === 'monthly' ? '499' : '4990'}
            </div>
            <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
              ₹{billing === 'monthly' ? '999' : '9990'}
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '20px 16px', gap: '16px' }}>
            <div />
            <button 
              className="button primary" 
              style={{ justifyContent: 'center', background: '#F59E0B', color: '#fff', border: 'none' }}
              disabled={loading}
              onClick={handlePurchaseSubscription}
            >
              {loading ? <Loader2 className="spinning" size={16} /> : 'Select'}
            </button>
            <button className="button secondary" disabled style={{ justifyContent: 'center', opacity: 0.5 }}>Coming Soon</button>
            <button className="button secondary" disabled style={{ justifyContent: 'center', opacity: 0.5 }}>Coming Soon</button>
          </div>
        </div>

      </div>
    </div>
  );
}
