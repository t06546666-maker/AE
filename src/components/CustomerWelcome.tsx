import { uiText } from '../uiText';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { UserProfile } from '../types';

// Persist across logouts and app restarts; scoped to this account and device.
const welcomedAccounts = new Set<string>();

export function CustomerWelcome({ user }: { user: UserProfile }) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    let disposed = false;
    let busy = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const name = user.name?.trim() || user.full_name?.trim() || 'Customer';
    const welcomeKey = `ae_welcomed_customer_v2:${user.id}`;
    const welcome = async () => {
      if (disposed || busy || welcomedAccounts.has(user.id) || localStorage.getItem(welcomeKey) === '1') return;
      busy = true;
      setMessage(`Welcome, ${name}!`);
      let duration = 6000;
      try {
        if (Capacitor.isNativePlatform()) {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          let permission = await LocalNotifications.checkPermissions();
          if (permission.display === 'prompt' || permission.display === 'prompt-with-rationale') {
            permission = await LocalNotifications.requestPermissions();
          }
          if (disposed) return;
          if (permission.display !== 'granted') {
            setMessage(`Welcome, ${name}! Phone notifications are blocked. Enable AE notifications in phone Settings.`);
            duration = 15000;
          } else {
            if (Capacitor.getPlatform() === 'android') await LocalNotifications.createChannel({
              id: 'ae_welcome', name: 'AE Welcome', description: 'One-time customer welcome',
              importance: 5, visibility: 0, vibration: true,
            });
            if (disposed) return;
            // No future alarm: display immediately, without exact-alarm permission.
            await LocalNotifications.schedule({ notifications: [{
              id: 7001, title: `Welcome, ${name}!`,
              body: 'Good to see you at AE. Explore your points, shops and offers.',
              channelId: 'ae_welcome', extra: { type: 'local_welcome' },
            }] });
            console.info('AE local welcome notification posted');
            welcomedAccounts.add(user.id);
            localStorage.setItem(welcomeKey, '1');
          }
        } else {
          welcomedAccounts.add(user.id);
          localStorage.setItem(welcomeKey, '1');
        }
      } catch (error) {
        console.error('AE local welcome failed:', error);
        if (!disposed) setMessage(`Welcome, ${name}! Phone notification failed: ${error instanceof Error ? error.message : String(error)}`);
        duration = 15000;
      } finally {
        busy = false;
        if (!disposed) {
          clearTimeout(hideTimer);
          hideTimer = setTimeout(() => setMessage(''), duration);
        }
      }
    };
    const startTimer = setTimeout(() => void welcome(), 1500);
    return () => {
      disposed = true;
      clearTimeout(startTimer);
      clearTimeout(hideTimer);
    };
  }, [user.id, user.name, user.full_name]);

  return message ? <div role="status" style={{ position: 'fixed', zIndex: 10000, top: 'calc(env(safe-area-inset-top, 0px) + 16px)', left: '50%', transform: 'translateX(-50%)', width: 'min(90vw, 420px)', padding: '16px 20px', borderRadius: 18, background: '#ffffffee', color: '#063d46', boxShadow: '0 8px 35px #003d4930', border: '1px solid #a5e7df', display: 'flex', gap: 12, alignItems: 'center' }}>
    <span style={{ flex: 1 }}>{message}</span><button type="button" aria-label={uiText("Dismiss welcome")} onClick={() => setMessage('')} style={{ border: 0, background: 'transparent', color: 'inherit', fontSize: 22, minWidth: 44, minHeight: 44 }}>×</button>
  </div> : null;
}
