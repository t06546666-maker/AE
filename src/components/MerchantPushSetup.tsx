import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { BellRing, CheckCircle2, AlertTriangle, RefreshCw, Smartphone } from 'lucide-react';
import { apiFetch } from '../api';
import { uiText } from '../uiText';

export function MerchantPushSetup({ userId }: { userId: string }) {
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const client = useQueryClient();

  const status = useQuery({
    queryKey: ['merchant-push-status', userId],
    queryFn: () => apiFetch<{ registered: boolean; enabled: boolean; firebaseReady: boolean }>('/api/merchant/push-status'),
    staleTime: 30000,
  });

  useEffect(() => {
    const update = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail);
      setIsError(false);
      void client.invalidateQueries({ queryKey: ['merchant-push-status', userId] });
    };
    window.addEventListener('ae:push-status', update);
    return () => window.removeEventListener('ae:push-status', update);
  }, [client, userId]);

  const isRegistered = Boolean(status.data?.registered && status.data?.enabled);
  const isNative = Capacitor.isNativePlatform();

  return (
    <div
      style={{
        marginBottom: 16,
        padding: '14px 16px',
        borderRadius: 14,
        background: isRegistered
          ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'
          : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        border: `1px solid ${isRegistered ? '#bbf7d0' : '#fde68a'}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200, flex: 1 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: isRegistered ? '#16a34a' : '#d97706',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isRegistered ? <BellRing size={19} /> : <AlertTriangle size={19} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: isRegistered ? '#14532d' : '#78350f' }}>
                {uiText(isRegistered ? 'Phone Notifications Active' : 'Phone Notifications Not Connected')}
              </span>
              {isRegistered && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#15803d',
                    background: '#dcfce7',
                    padding: '1px 7px',
                    borderRadius: 12,
                  }}
                >
                  <CheckCircle2 size={11} /> {uiText('Verified')}
                </span>
              )}
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: isRegistered ? '#166534' : '#92400e', lineHeight: 1.35 }}>
              {uiText(
                isRegistered
                  ? 'Your device receives checkout alerts, payments, and admin announcements.'
                  : 'Connect this phone to receive instant checkout alerts when customers request bills.'
              )}
            </p>
          </div>
        </div>

        {!isRegistered && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isNative ? (
              <button
                type="button"
                className="button primary"
                style={{ fontSize: '12px', padding: '6px 12px', height: 'auto' }}
                onClick={() => {
                  setMessage(uiText('Connecting phone notifications…'));
                  setIsError(false);
                  window.dispatchEvent(new Event('ae:register-push'));
                }}
              >
                <Smartphone size={14} style={{ marginRight: 4 }} />
                {uiText('Connect This Phone')}
              </button>
            ) : (
              <span style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                {uiText('Open in Android app to activate push')}
              </span>
            )}

            <button
              type="button"
              className="button secondary"
              style={{ fontSize: '12px', padding: '6px 9px', height: 'auto', background: '#ffffff' }}
              onClick={() => void status.refetch()}
              title={uiText('Refresh status')}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        )}
      </div>

      {message && (
        <div
          style={{
            marginTop: 8,
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: '12px',
            fontWeight: 500,
            background: isError ? '#fef2f2' : '#f0fdf4',
            color: isError ? '#991b1b' : '#166534',
            border: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: isError ? '#991b1b' : '#166534', padding: '0 4px' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
