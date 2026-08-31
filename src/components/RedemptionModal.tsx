import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../api';
import { useToast } from '../toast';

interface RedemptionModalProps {
  merchantId: string;
  onClose: () => void;
}

export function RedemptionModal({ merchantId, onClose }: RedemptionModalProps) {
  const [customerCode, setCustomerCode] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [result, setResult] = useState<{ discountAmount: number; newBalance: number } | null>(null);

  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const redeem = useMutation({
    mutationFn: () => apiFetch<{ discountAmount: number; newBalance: number }>(`/api/merchants/${merchantId}/redeem`, {
      method: 'POST',
      body: JSON.stringify({
        customerCode: customerCode.trim(),
        transactionAmount: Number(transactionAmount),
        pointsToRedeem: Number(pointsToRedeem),
      })
    }),
    onSuccess(data) {
      setTimeout(() => setResult(data), 1500);
      showToast('Redemption successful!', 'success');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError(error: Error) {
      showToast(error.message, 'error');
    }
  });

  if (result) {
    return (
      <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="modal-content" style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ margin: '0 0 8px' }}>Redemption Successful</h2>
            <p style={{ color: 'var(--text-muted)' }}>Discount applied and points deducted.</p>
          </div>
          
          <div style={{ background: 'var(--bg-inset)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Discount to apply:</span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--success)' }}>₹{result.discountAmount.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Customer remaining points:</span>
              <strong>{result.newBalance} pts</strong>
            </div>
          </div>
          
          <button className="button primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={20} />
        </button>
        
        <h2 style={{ margin: '0 0 20px 0' }}>Redeem Points</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            Customer ID / Phone
            <input 
              className="input-field" 
              type="text" 
              value={customerCode} 
              onChange={e => setCustomerCode(e.target.value)} 
              placeholder="e.g. CUST-123 or phone number"
            />
          </label>
          
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            Transaction Amount (₹)
            <input 
              className="input-field" 
              type="number" 
              min="100" 
              value={transactionAmount} 
              onChange={e => setTransactionAmount(e.target.value)} 
            />
          </label>
          
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            Points to Redeem
            <input 
              className="input-field" 
              type="number" 
              min="100" 
              max="1000" 
              value={pointsToRedeem} 
              onChange={e => setPointsToRedeem(e.target.value)} 
            />
            <small style={{ color: 'var(--text-muted)' }}>Min: 100, Max: 1000</small>
          </label>
          
          <button 
            className="button primary" 
            style={{ 
              marginTop: '8px', 
              justifyContent: 'center',
              background: redeem.isSuccess ? '#10b981' : '',
              transition: 'background 0.3s'
            }} 
            disabled={redeem.isPending || !customerCode || !transactionAmount || !pointsToRedeem || redeem.isSuccess}
            onClick={() => redeem.mutate()}
          >
            {redeem.isPending ? 'Processing...' : redeem.isSuccess ? 'Successfully Redeemed!' : 'Calculate & Redeem'}
          </button>
        </div>
      </div>
    </div>
  );
}
