import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, MapPin, Store } from 'lucide-react';
import '../field-visits.css';

type Merchant = { id: string; name: string; merchant_code: string; address?: string; latitude?: number | null; longitude?: number | null; image_url?: string; distance: number | null };
type Visit = { id: string; merchant_id: string; status: string; check_in_at: string; check_out_at?: string | null; accuracy_m?: number | null; distance_m?: number | null; notes?: string; check_in_latitude?: number; check_in_longitude?: number; merchants?: { name?: string; merchant_code?: string } };
export function FieldVisits({ merchants, visits, active, notes, setNotes, onCheckIn, onCheckOut, busy, loading, error, retry }: {
  merchants: Merchant[]; visits: Visit[]; active: Visit | null; notes: string; setNotes: (value: string) => void;
  onCheckIn: (merchantId: string) => void; onCheckOut: () => void; busy: boolean; loading: boolean; error: string | null; retry: () => void;
}) {
  const [filter, setFilter] = useState<'today' | 'all'>('today');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const today = visits.filter(v => new Date(v.check_in_at).toDateString() === new Date(now).toDateString());
  const selected = visits.find(v => v.id === selectedId) || active;
  const merchant = merchants.find(m => m.id === selected?.merchant_id);
  const duration = selected ? Math.max(0, Math.floor(((selected.check_out_at ? new Date(selected.check_out_at).getTime() : now) - new Date(selected.check_in_at).getTime()) / 1000)) : 0;
  const time = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : '—';
  const mapLat = selected?.check_in_latitude ?? merchant?.latitude;
  const mapLng = selected?.check_in_longitude ?? merchant?.longitude;
  return <section className="field-visits">
    <header><div><h1>Visits &amp; Check-in</h1><p>Track field visits, check-ins and activity for your merchants</p></div></header>
    <div className="fv-stats">{[
      { title: "Today's Visits", value: today.length, Icon: CalendarDays },
      { title: 'Completed Today', value: today.filter(v => v.status === 'completed').length, Icon: CheckCircle2 },
      { title: 'In Progress', value: visits.filter(v => v.status === 'active').length, Icon: MapPin },
      { title: 'Merchants Available', value: merchants.length, Icon: Store },
    ].map(({ title, value, Icon }) => <div key={title}><Icon /><strong>{value}</strong><span>{title}</span></div>)}</div>
    {loading && <p role="status">Loading visit history…</p>}
    {error && <p role="alert">{error} <button onClick={retry}>Retry</button></p>}
    <div className="fv-grid"><div className="fv-panel">
      <div className="fv-tabs"><button aria-pressed={filter === 'today'} onClick={() => setFilter('today')}>Today's Visits ({today.length})</button><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All Visits</button></div>
      <div className="fv-history">{(filter === 'today' ? today : visits).map(v => <button className={`fv-visit ${selected?.id === v.id ? 'selected' : ''}`} key={v.id} onClick={() => setSelectedId(v.id)}><MapPin /><div><strong>{v.merchants?.name || merchants.find(m => m.id === v.merchant_id)?.name || 'Merchant'}</strong><small>{time(v.check_in_at)}</small></div><span className={`fv-badge ${v.status}`}>{v.status === 'active' ? 'In Progress' : v.status}</span></button>)}{!(filter === 'today' ? today : visits).length && !loading && <p className="fv-empty">No visits recorded {filter === 'today' ? 'today' : 'yet'}.</p>}</div>
      <h2>Start a merchant visit</h2><input aria-label="Search merchants for check-in" placeholder="Search merchants…" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="fv-merchants">{merchants.filter(m => `${m.name} ${m.merchant_code}`.toLowerCase().includes(search.toLowerCase())).map(m => <div className="fv-merchant" key={m.id}>{m.image_url ? <img src={m.image_url} alt="" /> : <Store />}<div><strong>{m.name}</strong><small>{m.merchant_code} · {m.distance == null ? 'Location unavailable' : `${Math.round(m.distance)} m away`}</small></div><button disabled={Boolean(active) || busy || m.latitude == null || m.longitude == null} onClick={() => { setSelectedId(null); onCheckIn(m.id); }}>Check In</button></div>)}</div>
    </div><aside className="fv-panel fv-activity"><h2>Check-in Activity</h2>{selected ? <>
      <div className="fv-activity-name"><Store /><div><strong>{selected.merchants?.name || merchant?.name || 'Merchant'}</strong><small>{selected.merchants?.merchant_code || merchant?.merchant_code}</small></div><span className={`fv-badge ${selected.status}`}>{selected.status === 'active' ? 'Checked In' : 'Completed'}</span></div>
      <dl><dt>Check-in Time</dt><dd>{time(selected.check_in_at)}</dd><dt>Location</dt><dd>{merchant?.address || 'No address saved'}</dd><dt>Check-out Time</dt><dd>{time(selected.check_out_at)}</dd><dt>Duration</dt><dd>{Math.floor(duration / 3600)}h {Math.floor(duration % 3600 / 60)}m {duration % 60}s</dd><dt>GPS Accuracy</dt><dd>{selected.accuracy_m == null ? 'Unavailable' : `±${Math.round(selected.accuracy_m)} m`}</dd><dt>Distance at Check-in</dt><dd>{selected.distance_m == null ? 'Unavailable' : `${Math.round(selected.distance_m)} m`}</dd><dt>GPS Coordinates</dt><dd>{mapLat != null && mapLng != null ? `${mapLat}, ${mapLng}` : 'Unavailable'}</dd></dl>
      {mapLat != null && mapLng != null && <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps?q=${mapLat},${mapLng}`}>View on Map ↗</a>}
      {selected.id === active?.id ? <><p>Record notes, problems, feedback and follow-up details in the visit report. Review everything before ending the visit.</p><button className="fv-checkout" disabled={busy} onClick={onCheckOut}><MapPin size={18} />{busy ? 'Opening…' : 'Open Visit Report'}</button></> : <><h3>Visit Notes</h3><p>{selected.notes || 'No notes recorded.'}</p></>}
    </> : <p className="fv-empty">Select a recorded visit or check in at a merchant to view activity.</p>}</aside></div>
    <p className="fv-footnote">Check-in uses your browser GPS. The server validates the 50-metre merchant radius. No planned or missed visits are invented.</p>
  </section>;
}
