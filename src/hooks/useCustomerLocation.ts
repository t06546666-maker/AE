import { useQuery } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { loadGoogleMaps } from '../components/CustomerNearbyMap';

export function useCustomerLocation() {
  return useQuery({
    queryKey: ['customer', 'current-location'],
    queryFn: async () => {
      let coords: { latitude: number; longitude: number };
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.requestPermissions();
        if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') throw new Error('Allow location access to find shops near you.');
        coords = (await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })).coords;
      } else {
        if (!navigator.geolocation) throw new Error('Location is unavailable on this device.');
        coords = await new Promise<GeolocationCoordinates>((resolve, reject) => navigator.geolocation.getCurrentPosition(position => resolve(position.coords), () => reject(new Error('Allow location access and turn on GPS, then try again.')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }));
      }
      let area = 'Current GPS location';
      if (import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
        try {
          const google = await loadGoogleMaps();
          const response: any = await new Promise((resolve, reject) => new google.maps.Geocoder().geocode({ location: { lat: coords.latitude, lng: coords.longitude } }, (results: any, status: string) => status === 'OK' ? resolve(results) : reject(new Error(status))));
          const parts = response[0]?.address_components || [];
          const find = (type: string) => parts.find((part: any) => part.types.includes(type))?.long_name;
          area = [find('sublocality_level_1') || find('sublocality'), find('locality') || find('administrative_area_level_2')].filter(Boolean).join(', ') || area;
        } catch { /* GPS still works if the area-name service is unavailable. */ }
      }
      return { latitude: coords.latitude, longitude: coords.longitude, area };
    },
    retry: false,
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
