import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search, Store } from 'lucide-react';
import '../field-mapper.css';

type Merchant = { id: string; name: string; merchant_code: string; category_id?: string; address?: string; latitude?: number | null; longitude?: number | null; image_url?: string };
type Category = { id: string; name: string };
let mapsPromise: Promise<any> | undefined;
export function loadMaps(key: string) {
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (!mapsPromise) mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    script.async = true;
    const timer = window.setTimeout(() => reject(new Error('Map loading timed out. Check your connection and Maps API settings.')), 15000);
    script.onload = () => { clearTimeout(timer); (window as any).google?.maps ? resolve((window as any).google) : reject(new Error('Google Maps is unavailable.')); };
    script.onerror = () => { clearTimeout(timer); reject(new Error('Google Maps could not load. Check the API key and allowed website domains.')); };
    document.head.appendChild(script);
  }).catch(error => { mapsPromise = undefined; throw error; });
  return mapsPromise;
}
function hasLocation(m: Merchant) { return m.latitude != null && m.longitude != null && Number.isFinite(Number(m.latitude)) && Number.isFinite(Number(m.longitude)) && Math.abs(Number(m.latitude)) <= 90 && Math.abs(Number(m.longitude)) <= 180; }
export function FieldMerchantMapper({ merchants, categories, visitPosition }: { merchants: Merchant[]; categories: Category[]; visitPosition?: { latitude: number; longitude: number } | null }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const filtered = useMemo(() => merchants.filter(m => `${m.name} ${m.merchant_code} ${m.address || ''}`.toLowerCase().includes(search.toLowerCase()) && (!category || m.category_id === category) && (!locationFilter || hasLocation(m) === (locationFilter === 'mapped'))), [merchants, search, category, locationFilter]);
  const located = useMemo(() => filtered.filter(hasLocation), [filtered]);
  const selectedMerchant = filtered.find(m => m.id === selected);
  const mappedTotal = merchants.filter(hasLocation).length;
  useEffect(() => {
    if (!key || !container.current) return;
    let alive = true;
    setError(''); setReady(false);
    loadMaps(key).then(google => {
      if (!alive || !container.current) return;
      map.current = new google.maps.Map(container.current, { center: { lat: 20.5937, lng: 78.9629 }, zoom: 5, mapTypeControl: false, streetViewControl: false });
      setReady(true);
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; map.current = null; };
  }, [key, attempt]);
  useEffect(() => {
    const google = (window as any).google;
    if (!ready || !map.current || !google?.maps) return;
    const bounds = new google.maps.LatLngBounds();
    const markers = located.map(m => {
      const position = { lat: Number(m.latitude), lng: Number(m.longitude) };
      bounds.extend(position);
      const marker = new google.maps.Marker({ map: map.current, position, title: `${m.name} · ${m.merchant_code}` });
      marker.addListener('click', () => setSelected(m.id));
      return marker;
    });
    if (located.length) { map.current.fitBounds(bounds, 40); if (located.length === 1) map.current.setZoom(14); }
    return () => markers.forEach(marker => { google.maps.event.clearInstanceListeners(marker); marker.setMap(null); });
  }, [located, ready]);
  useEffect(() => { if (ready && selectedMerchant && hasLocation(selectedMerchant)) { map.current?.panTo({ lat: Number(selectedMerchant.latitude), lng: Number(selectedMerchant.longitude) }); map.current?.setZoom(16); } }, [selectedMerchant, ready]);
  useEffect(() => { map.current?.setMapTypeId(satellite ? 'satellite' : 'roadmap'); }, [satellite, ready]);
  useEffect(() => {
    if (!ready || visitPosition === undefined || !located[0]) return;
    const google = (window as any).google;
    const circle = new google.maps.Circle({ map: map.current, center: { lat: Number(located[0].latitude), lng: Number(located[0].longitude) }, radius: 50, fillColor: '#00aeef', fillOpacity: 0.16, strokeColor: '#007aff', strokeOpacity: 0.5, strokeWeight: 1 });
    const marker = visitPosition ? new google.maps.Marker({ map: map.current, position: { lat: visitPosition.latitude, lng: visitPosition.longitude }, title: 'Your location', icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#0064ff', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 } }) : null;
    map.current.fitBounds(circle.getBounds(), 35);
    return () => { circle.setMap(null); marker?.setMap(null); };
  }, [ready, located, visitPosition]);
  return <section className="field-mapper"><h1>Merchant Mapper</h1><p>View merchant locations and identify stores that need GPS coordinates.</p>
    <div className="fm-filters"><label><Search size={17} /><input aria-label="Search merchant locations" placeholder="Search location, store or merchant ID…" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All Categories</option>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select><select aria-label="Location filter" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}><option value="">All Locations</option><option value="mapped">GPS Added</option><option value="missing">GPS Missing</option></select></div>
    <div className="fm-grid"><div className="fm-list"><h2>Merchants ({filtered.length})</h2>{filtered.map(m => <button key={m.id} className={selected === m.id ? 'selected' : ''} onClick={() => setSelected(m.id)}>{m.image_url ? <img src={m.image_url} alt="" /> : <Store />}<div><strong>{m.name}</strong><small>{m.merchant_code} · {m.address || 'No address saved'}</small><span>{hasLocation(m) ? 'GPS Added' : 'GPS Missing'}</span></div></button>)}{!filtered.length && <p>No matching merchants.</p>}</div>
    <div className="fm-map-panel"><div className="fm-map-tabs"><button aria-pressed={!satellite} onClick={() => setSatellite(false)}>Map</button><button aria-pressed={satellite} onClick={() => setSatellite(true)}>Satellite</button></div><div ref={container} className="fm-map" />{(!key || error || !ready) && <div className="fm-map-message" role="status">{!key ? 'A Google Maps API key is required for the live map. Merchant details remain available.' : error || 'Loading map…'}{error && <button onClick={() => setAttempt(attempt + 1)}>Retry</button>}</div>}{ready && !located.length && <p className="fm-no-pins">No saved GPS locations match these filters.</p>}{selectedMerchant && <div className="fm-selected"><strong>{selectedMerchant.name}</strong><p>{selectedMerchant.address || 'No address saved'}</p>{hasLocation(selectedMerchant) ? <><small>{selectedMerchant.latitude}, {selectedMerchant.longitude}</small><a href={`https://www.google.com/maps?q=${selectedMerchant.latitude},${selectedMerchant.longitude}`} target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a></> : <small>This merchant has no saved GPS location.</small>}</div>}</div>
    <aside className="fm-summary"><h2>Coverage Summary</h2><div><Store /><strong>{merchants.length}</strong><span>Total Merchants</span></div><div><MapPin /><strong>{mappedTotal}</strong><span>With GPS Location</span></div><div><MapPin /><strong>{merchants.length - mappedTotal}</strong><span>Missing GPS</span></div><div><strong>{merchants.length ? Math.round(mappedTotal / merchants.length * 100) : 0}%</strong><span>Merchants Mapped</span></div><p>Territory coverage and manager assignment require backend support and are not enabled yet.</p></aside></div>
  </section>;
}
