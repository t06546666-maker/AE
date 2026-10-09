import { uiText } from '../uiText';
import { useEffect, useRef, useState } from 'react';
import { loadMaps } from './FieldMerchantMapper';

type Stop = { id: string; name: string; latitude?: number; longitude?: number };
export function FieldRouteMap({ merchants }: { merchants: Stop[] }) {
  const stops = merchants.filter(m => m.latitude != null && m.longitude != null && Number.isFinite(Number(m.latitude)) && Number.isFinite(Number(m.longitude)) && Math.abs(Number(m.latitude)) <= 90 && Math.abs(Number(m.longitude)) <= 180);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const renderer = useRef<any>(null);
  const generation = useRef(0);
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  useEffect(() => {
    let alive = true;
    if (!key) { setError('Google Maps key is not configured.'); return; }
    loadMaps(key).then(google => {
      if (!alive || !host.current) return;
      map.current = new google.maps.Map(host.current, { center: { lat: 10.7, lng: 76.7 }, zoom: 12, streetViewControl: false });
      renderer.current = new google.maps.DirectionsRenderer({ map: map.current, suppressMarkers: true });
      setReady(true);
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; generation.current++; renderer.current?.setMap(null); };
  }, [key]);
  const toggle = (id: string) => {
    generation.current++; setBusy(false); setSummary('');
    renderer.current?.set('directions', null);
    setChosen(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  };
  useEffect(() => {
    if (!ready) return;
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
  }, [ready, merchants, chosen]);
  async function build() {
    const selected = chosen.map(id => stops.find(stop => stop.id === id)!);
    if (selected.length < 2 || selected.length > 27) { setError('Choose between 2 and 27 stops.'); return; }
    const request = ++generation.current;
    setBusy(true); setError(''); setSummary('');
    const google = (window as any).google;
    const position = (stop: Stop) => ({ lat: Number(stop.latitude), lng: Number(stop.longitude) });
    try {
      const result = await new google.maps.DirectionsService().route({ origin: position(selected[0]), destination: position(selected[selected.length - 1]), waypoints: selected.slice(1, -1).map(stop => ({ location: position(stop), stopover: true })), optimizeWaypoints: false, travelMode: google.maps.TravelMode.DRIVING });
      if (request !== generation.current) return;
      renderer.current.setDirections(result);
      const metres = result.routes[0].legs.reduce((total: number, leg: any) => total + (leg.distance?.value || 0), 0);
      setSummary(`${selected.length} stops · ${(metres / 1000).toFixed(1)} km`);
    } catch { if (request === generation.current) setError('Road route unavailable. Check Directions API settings and merchant locations.'); }
    finally { if (request === generation.current) setBusy(false); }
  }
  return <article className="route-summary" style={{ display: 'block' }}><h2>{uiText("Route map")}</h2><p>{uiText("Select stops in visit order, using the map or checkboxes.")}</p><div ref={host} aria-label={uiText("Merchant route map")} style={{ height: 320, borderRadius: 16 }} />{merchants.length > stops.length && <p>{merchants.length - stops.length}{uiText(" merchants need valid GPS coordinates before they can be mapped.")}</p>}<div>{stops.map(stop => <label key={stop.id} style={{ display: 'block', padding: 8 }}><input type="checkbox" checked={chosen.includes(stop.id)} onChange={() => toggle(stop.id)} /> {chosen.includes(stop.id) ? `${chosen.indexOf(stop.id) + 1}. ` : ''}{stop.name}</label>)}</div><button className="button primary" disabled={!ready || busy || chosen.length < 2} onClick={() => void build()}>{busy ? uiText("Calculating…") : uiText("Build road route")}</button>{summary && <p>{summary}</p>}{error && <p role="alert">{error}</p>}</article>;
}
