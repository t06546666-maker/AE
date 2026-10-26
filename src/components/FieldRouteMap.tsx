import { uiText } from '../uiText';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadMaps } from './FieldMerchantMapper';
import { hasShopLocation, shopRouteLinks, type ShopRouteStop } from '../shopRoute';

type Stop = ShopRouteStop;
export function FieldRouteMap({ merchants }: { merchants: Stop[] }) {
  const stops = useMemo(() => merchants.filter(hasShopLocation), [merchants]);
  const stopSignature = JSON.stringify(stops.map(stop => [stop.id, stop.latitude, stop.longitude]));
  const [chosen, setChosen] = useState<string[]>([]);
  const externalRoutes = useMemo(() => { try { return shopRouteLinks(chosen, stops); } catch { return []; } }, [chosen, stops]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  useEffect(() => {
    let alive = true;
    if (!key) { setError('Google Maps key is not configured.'); return; }
    loadMaps(key).then(google => {
      if (!alive || !host.current) return;
      map.current = new google.maps.Map(host.current, { center: { lat: 10.7, lng: 76.7 }, zoom: 12, streetViewControl: false });
      setReady(true);
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; map.current = null; };
  }, [key]);
  const toggle = (id: string) => {
    setChosen(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  };
  useEffect(() => {
    // Deleted shops must not remain in the selected navigation route.
    setChosen(ids => { const retained = ids.filter(id => stops.some(stop => stop.id === id)); return retained.length === ids.length ? ids : retained; });
  }, [stopSignature]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const google = (window as any).google;
    const bounds = new google.maps.LatLngBounds();
    const markers = stops.map(stop => {
      const position = { lat: Number(stop.latitude), lng: Number(stop.longitude) };
      bounds.extend(position);
      const index = chosen.indexOf(stop.id);
      const marker = new google.maps.Marker({ map: map.current, position, title: stop.name, label: index < 0 ? undefined : String(index + 1) });
      marker.addListener('click', () => toggle(stop.id));
      return marker;
    });
    if (stops.length) { map.current.fitBounds(bounds, 35); if (stops.length === 1) map.current.setZoom(16); }
    return () => markers.forEach(marker => { google.maps.event.clearInstanceListeners(marker); marker.setMap(null); });
  }, [ready, stops, chosen]);
  return <article className="route-summary" style={{ display: 'block' }}>
    <h2>{uiText('Route map')}</h2>
    <p>{uiText('Select stops in visit order, using the map or checkboxes.')}</p>
    <p>{uiText('Planned route between selected shops.')}</p>
    <div ref={host} aria-label={uiText('Merchant route map')} style={{ height: 320, borderRadius: 16 }} />
    {merchants.length > stops.length && <p>{merchants.length - stops.length}{uiText(' merchants need valid GPS coordinates before they can be mapped.')}</p>}
    <div className="route-stop-list">{stops.map(stop => <label key={stop.id}>
      <input type="checkbox" checked={chosen.includes(stop.id)} onChange={() => toggle(stop.id)} />
      <span>{chosen.includes(stop.id) ? `${chosen.indexOf(stop.id) + 1}. ` : ''}{stop.name}</span>
    </label>)}</div>
    {!externalRoutes.length && <p>{uiText('Choose at least two shops to open directions.')}</p>}
    <div className="fm-scope-switch">{externalRoutes.map((section, index) => <a className="button primary" key={section.url} href={section.url} target="_blank" rel="noopener noreferrer">{uiText(externalRoutes.length === 1 ? 'Open route in Google Maps' : 'Open route section {{number}} (stops {{from}}–{{to}})', { number: index + 1, from: section.from, to: section.to })}</a>)}</div>
    {externalRoutes.length > 1 && <p>{uiText('Long routes are split into sections so every selected shop is included on mobile.')}</p>}
    {error && <p role="alert">{uiText(error)}</p>}
  </article>;
}
