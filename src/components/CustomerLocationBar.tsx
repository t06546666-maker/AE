import { uiText } from '../uiText';
import { useState } from 'react';
import { ChevronDown, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { useCustomerLocation } from '../hooks/useCustomerLocation';
import { loadGoogleMaps } from './CustomerNearbyMap';

type Area = { latitude: number; longitude: number; area: string };
export function CustomerLocationBar({ compact = false }: { compact?: boolean }) {
  const location = useCustomerLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Area[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function findAreas(event: React.FormEvent) {
    event.preventDefault();
    if (!search.trim() || busy) return;
    setBusy(true); setError(''); setResults([]);
    try {
      if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) throw new Error('Area search needs the Google Maps configuration. You can still use current GPS location.');
      const google = await loadGoogleMaps();
      const found: any[] = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Location search timed out. Try again.')), 15000);
        new google.maps.Geocoder().geocode({ address: search.trim(), componentRestrictions: { country: 'IN' } }, (items: any[], status: string) => { clearTimeout(timer); if (status === 'OK') resolve(items); else reject(new Error(status === 'ZERO_RESULTS' ? "No matching area found. Try the town name or postcode." : "Location search is unavailable. Try again.")); });
      });
      setResults(found.slice(0, 5).map(item => ({ latitude: item.geometry.location.lat(), longitude: item.geometry.location.lng(), area: item.formatted_address })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not search this area."); }
    finally { setBusy(false); }
  }
  async function useGps() {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await location.refetch(); if (result.isError) setError(result.error?.message || 'Could not find your location.'); else setOpen(false); }
    finally { setBusy(false); }
  }
  return <>
    {compact ? <button type="button" className="ae-location-pill" onClick={() => setOpen(true)} aria-label={uiText("Choose shopping location")}><MapPin size={21}/><span>{location.isFetching ? uiText("Locating…") : location.data?.area || 'Select location'}</span><ChevronDown size={16}/></button> : <button type="button" className="mx-4 my-2 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-gray-900" onClick={() => setOpen(true)} aria-label={uiText("Choose shopping location")}><MapPin size={20}/><span>{location.data?.area || 'Select location for nearby shops'}</span><ChevronDown size={18}/></button>}
    {open && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="ae-location-title" style={{ maxWidth: 440 }}><div className="panel-heading"><h2 id="ae-location-title">{uiText("Choose your location")}</h2><button type="button" className="icon-button" aria-label={uiText("Close location picker")} onClick={() => setOpen(false)}><X size={20}/></button></div><p>{uiText("See shops near your selected area.")}</p><button type="button" className="button secondary full-button" disabled={busy} onClick={() => void useGps()}><LocateFixed size={18}/>{busy ? uiText("Please wait…") : uiText("Use Current Location")}</button><form onSubmit={findAreas} style={{ marginTop: 18 }}><label>{uiText("Town, area or postcode")}<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={uiText("e.g. Chittur, Palakkad")} required maxLength={150}/></label><button className="button primary full-button" style={{ marginTop: 10 }} disabled={busy || !search.trim()}><Search size={17}/>{busy ? uiText("Searching…") : uiText("Find location")}</button></form>{error && <p className="form-error" role="alert">{error}</p>}<div aria-live="polite" style={{ display: 'grid', gap: 10, marginTop: 16 }}>{results.map(area => <button type="button" className="button secondary" style={{ textAlign: 'left', whiteSpace: 'normal' }} key={`${area.latitude},${area.longitude}`} onClick={() => { location.selectLocation(area); setOpen(false); }}><MapPin size={18}/>{area.area}</button>)}</div></section></div>}
  </>;
}
