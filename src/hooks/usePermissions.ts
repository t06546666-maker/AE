import { useState, useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { useUpdateCustomerPreferences } from './useCustomerData';

export function usePermissions() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const { mutate: updatePreferences } = useUpdateCustomerPreferences();

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const pushStatus = await PushNotifications.checkPermissions();
      setPushEnabled(pushStatus.receive === 'granted');

      const locStatus = await Geolocation.checkPermissions();
      setLocationEnabled(locStatus.location === 'granted');
    } catch (e) {
      console.warn('Could not check permissions', e);
    }
  };

  const requestPush = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert('Push notifications are only available on native devices.');
      return false;
    }

    try {
      let status = await PushNotifications.checkPermissions();
      if (status.receive !== 'granted') {
        status = await PushNotifications.requestPermissions();
      }

      const granted = status.receive === 'granted';
      setPushEnabled(granted);
      
      if (granted) {
        await PushNotifications.register();
        // The token registration is handled in App.tsx event listeners, 
        // but we update the boolean preference immediately.
        updatePreferences({ push_enabled: true });
      } else {
        updatePreferences({ push_enabled: false });
      }
      return granted;
    } catch (e) {
      console.error('Error requesting push permission', e);
      return false;
    }
  };

  const requestLocation = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert('Location services are only available on native devices.');
      return false;
    }

    try {
      let status = await Geolocation.checkPermissions();
      if (status.location !== 'granted') {
        status = await Geolocation.requestPermissions();
      }

      const granted = status.location === 'granted';
      setLocationEnabled(granted);
      updatePreferences({ location_enabled: granted });
      return granted;
    } catch (e) {
      console.error('Error requesting location permission', e);
      return false;
    }
  };

  const setWhatsApp = (enabled: boolean) => {
    updatePreferences({ whatsapp_enabled: enabled });
  };

  return {
    pushEnabled,
    locationEnabled,
    requestPush,
    requestLocation,
    setWhatsApp,
    checkPermissions
  };
}
