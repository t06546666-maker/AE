import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, getAccessToken, getRefreshToken } from '../api';
import { uiText } from '../uiText';

interface NativeFieldLocationService {
  start(options: { accessToken: string; refreshToken: string }): Promise<{ running: boolean }>;
  stop(): Promise<{ running: boolean }>;
  isRunning(): Promise<{ running: boolean }>;
  openAppSettings(): Promise<void>;
}

const NativeFieldLocation = registerPlugin<NativeFieldLocationService>('FieldLocationService');
const PREF_KEY = 'ae-field-location-sharing-enabled';
const DISCLOSURE = 'AE collects your location to let authorised Admins view your latest workday position, even when the app is closed or not in use. Sharing runs only during an active workday, is shown by an ongoing Android notification, and stops when you end your day or tap Stop sharing. AE updates your latest position; it does not create a route history.';

export function FieldLocationSharing({ managerId }: { managerId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [settingsRequired, setSettingsRequired] = useState(false);
  const [error, setError] = useState('');
  const isAndroid = Capacitor.getPlatform() === 'android';
  const work = useQuery({
    queryKey: ['field-attendance', 'location-status', managerId],
    queryFn: () => apiFetch<{ active: boolean }>('/api/field/location/status'),
    enabled: isAndroid,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!isAndroid) return;
    let alive = true;
    void NativeFieldLocation.isRunning().then(({ running }) => {
      if (alive) {
        setEnabled(running);
        localStorage.setItem(PREF_KEY, String(running));
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [isAndroid]);

  useEffect(() => {
    if (!isAndroid || !enabled || work.data?.active !== false) return;
    void stopSharing();
  }, [enabled, isAndroid, work.data?.active]);

  useEffect(() => {
    if (!isAndroid) return;
    const stopOnSessionClear = () => {
      void NativeFieldLocation.stop().finally(() => {
        setEnabled(false);
        localStorage.setItem(PREF_KEY, 'false');
      });
    };
    window.addEventListener('ae:session-cleared', stopOnSessionClear);
    return () => window.removeEventListener('ae:session-cleared', stopOnSessionClear);
  }, [isAndroid]);

  async function startSharing() {
    setError('');
    if (!work.data?.active) {
      setError(uiText('Start your attendance day before enabling workday location sharing.'));
      return;
    }
    if (!isAndroid) {
      setError(uiText('Background workday location sharing is available in the installed AE Android app.'));
      return;
    }
    try {
      let location = await Geolocation.checkPermissions();
      if (location.location !== 'granted' && location.coarseLocation !== 'granted') {
        location = await Geolocation.requestPermissions();
      }
      if (location.location !== 'granted' && location.coarseLocation !== 'granted') {
        setError(uiText('Allow location access to start workday sharing.'));
        return;
      }

      let notification = await LocalNotifications.checkPermissions();
      if (notification.display !== 'granted') notification = await LocalNotifications.requestPermissions();
      if (notification.display !== 'granted') {
        setError(uiText('Allow notifications so Android can show the active sharing indicator.'));
        return;
      }

      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();
      if (!accessToken || !refreshToken) {
        setError(uiText('Please sign in again before starting workday sharing.'));
        return;
      }
      await NativeFieldLocation.start({ accessToken, refreshToken });
      setEnabled(true);
      localStorage.setItem(PREF_KEY, 'true');
      setShowNotice(false);
      setSettingsRequired(false);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (/Allow all the time|BACKGROUND_LOCATION_PERMISSION_REQUIRED/i.test(message)) setSettingsRequired(true);
      setError(uiText(message || 'Unable to start workday location sharing.'));
    }
  }

  async function stopSharing() {
    setError('');
    try {
      if (isAndroid) await NativeFieldLocation.stop();
      setEnabled(false);
      localStorage.setItem(PREF_KEY, 'false');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : uiText('Unable to stop workday location sharing.'));
    }
  }

  return <>
    <section style={{ margin: '10px 16px', padding: '10px 12px', border: '1px solid #dce6f2', borderRadius: 12, background: '#f5f9ff' }} aria-label={uiText('Workday location sharing')}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <strong>{uiText(enabled ? 'Workday location sharing is on' : 'Workday location sharing')}</strong>
          <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.45 }}>{uiText(enabled ? 'An ongoing Android notification shows while sharing is active. It stops when your workday ends.' : 'Share your latest workday position with authorised Admins while attendance is active.')}</p>
        </div>
        {enabled
          ? <button type="button" className="button secondary" onClick={() => void stopSharing()}>{uiText('Stop sharing')}</button>
          : <button type="button" className="button secondary" onClick={() => { setError(''); setShowNotice(true); }}>{uiText('Start sharing')}</button>}
      </div>
      {settingsRequired && <p style={{ fontSize: 12, marginBottom: 0 }}>{uiText('In Android App info → Permissions → Location, choose Allow all the time. Return to AE and tap Start sharing again.')} <button type="button" className="button secondary" onClick={() => void NativeFieldLocation.openAppSettings()}>{uiText('Open settings')}</button></p>}
      {(error || work.isError) && <p role="alert" style={{ fontSize: 12, marginBottom: 0 }}>{error || uiText('Workday status unavailable. Location sharing could not be verified.')}</p>}
    </section>
    {showNotice && <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(8, 20, 38, .48)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="field-location-notice-title" style={{ width: 'min(100%, 440px)', padding: 20, borderRadius: 16, background: 'white', color: '#10233f', boxShadow: '0 16px 48px rgba(0,0,0,.25)' }}>
        <h2 id="field-location-notice-title" style={{ marginTop: 0 }}>{uiText('Workday location sharing')}</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>{uiText(DISCLOSURE)}</p>
        <p style={{ fontSize: 13, lineHeight: 1.5 }}>{uiText('Android will show its location and notification permission prompts next. You can stop sharing at any time from this screen or the ongoing notification.')}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="button secondary" onClick={() => setShowNotice(false)}>{uiText('Not now')}</button>
          <button type="button" className="button primary" disabled={work.isPending || work.data?.active !== true} onClick={() => void startSharing()}>{uiText('I understand — start sharing')}</button>
        </div>
      </section>
    </div>}
  </>;
}
