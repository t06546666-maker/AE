import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import type { CustomerMerchant } from '../hooks/useCustomerData';

type Coordinates = { latitude: number; longitude: number };

const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

function loadGoogleMaps() {
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  return new Promise<any>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-ae-google-maps]');
    if (existing) { existing.addEventListener('load', () => resolve((window as any).google)); existing.addEventListener('error', reject); return; }
    const script = document.createElement('script');
    script.dataset.aeGoogleMaps = 'true';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsKey || '')}&v=weekly`;
    script.onload = () => resolve((window as any).google);
    script.onerror = () => reject(new Error('Google Maps could not be loaded.'));
    document.head.appendChild(script);
  });
}

async function getCurrentLocation(): Promise<Coordinates> {
  if (Capacitor.isNativePlatform()) {
    const permission = await Geolocation.requestPermissions();
    if (permission.location !== 'granted') throw new Error('Location permission was not granted.');
    const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000 });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  }
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
    () => reject(new Error('Location permission was not granted.')), { enableHighAccuracy: true, timeout: 12000 },
  ));
}

export function CustomerNearbyMap({ merchants, selectedMerchantId }: { merchants: CustomerMerchant[]; selectedMerchantId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [status, setStatus] = useState(mapsKey ? 'Tap Locate AE to find merchants near you.' : 'Add VITE_GOOGLE_MAPS_API_KEY to enable the live map.');
  const locatedMerchants = merchants.filter((m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude));

  useEffect(() => {
    if (!mapsKey || !containerRef.current) return;
    let active = true;
    loadGoogleMaps().then((google) => {
      if (!active || !containerRef.current) return;
      mapRef.current = new google.maps.Map(containerRef.current, {
        center: { lat: 20.5937, lng: 78.9629 }, zoom: 5, disableDefaultUI: true, zoomControl: true,
      });
      locatedMerchants.forEach((merchant) => {
        const marker = new google.maps.Marker({
          map: mapRef.current,
          position: { lat: merchant.latitude!, lng: merchant.longitude! },
          title: merchant.merchant_name,
        });
        marker.addListener('click', () => { mapRef.current?.panTo({ lat: merchant.latitude!, lng: merchant.longitude! }); mapRef.current?.setZoom(16); });
      });
      getCurrentLocation().then((location) => { if (!active || !mapRef.current) return; mapRef.current.setCenter({ lat: location.latitude, lng: location.longitude }); mapRef.current.setZoom(13); new google.maps.Marker({ map: mapRef.current, position: { lat: location.latitude, lng: location.longitude }, title: 'You are here', icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' }); setStatus('Showing your current location.'); }).catch(() => undefined);
    }).catch(() => active && setStatus('Google Maps could not load. Check your API key and allowed domains.'));
    return () => { active = false; };
  }, [locatedMerchants]);

  useEffect(() => { const merchant = locatedMerchants.find((item) => item.id === selectedMerchantId); if (merchant && mapRef.current) { mapRef.current.panTo({ lat: merchant.latitude!, lng: merchant.longitude! }); mapRef.current.setZoom(16); } }, [selectedMerchantId, locatedMerchants]);

  async function locate() {
    try {
      setStatus('Finding your location…');
      const location = await getCurrentLocation();
      const map = mapRef.current;
      const google = (window as any).google;
      if (map && google?.maps) {
        map.setCenter({ lat: location.latitude, lng: location.longitude });
        map.setZoom(13);
        new google.maps.Marker({ map, position: { lat: location.latitude, lng: location.longitude }, title: 'You are here' });
      }
      setStatus(locatedMerchants.length ? `${locatedMerchants.length} merchant${locatedMerchants.length === 1 ? '' : 's'} with saved locations found.` : 'Your location is ready. No merchant locations have been added yet.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'We could not determine your location.'); }
  }

  return <section className="px-5 mb-6">
    <div className="bg-gray-100 rounded-3xl h-56 relative overflow-hidden shadow-inner border border-gray-200">
      <div ref={containerRef} className="absolute inset-0" />
      {!mapsKey && <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-emerald-50 to-blue-50 text-center px-7"><div><MapPin className="mx-auto mb-2 text-[#087a4b]" /><strong className="block text-gray-800">Nearby with Google Maps</strong><p className="mt-1 text-xs text-gray-500">Add your Maps key to show real merchant pins.</p></div></div>}
      <button type="button" onClick={() => void locate()} className="absolute right-3 bottom-3 flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#087a4b] shadow-lg"><LocateFixed size={16} /> Locate AE</button>
    </div>
    <p className="mt-2 text-xs text-gray-500">{status}</p>
    {locatedMerchants.map((merchant) => <a key={merchant.id} className="mt-2 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${merchant.latitude},${merchant.longitude}`} target="_blank" rel="noreferrer"><span><strong>{merchant.merchant_name}</strong>{merchant.address ? ` · ${merchant.address}` : ''}</span><Navigation size={16} className="text-[#087a4b]" /></a>)}
  </section>;
}
