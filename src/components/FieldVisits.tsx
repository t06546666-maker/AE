import { uiText } from '../uiText';
import { formatDateTime } from '../utils';
import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, MapPin, Store } from 'lucide-react';
import '../field-visits.css';
import { MERCHANT_ROUTES } from '../merchantRoutes';

type Merchant = { id: string; name: string; merchant_code: string; route_name?: string | null; address?: string; latitude?: number | null; longitude?: number | null; image_url?: string; distance: number | null };
type Visit = { id: string; merchant_id: string; status: string; check_in_at: string; check_out_at?: string | null; accuracy_m?: number | null; distance_m?: number | null; notes?: string; check_in_latitude?: number; check_in_longitude?: number; merchants?: { name?: string; merchant_code?: string } };
export function FieldVisits({ merchants, visits, active, notes, setNotes, onCheckIn, onCheckOut, busy, loading, error, retry }: {
  merchants: Merchant[]; visits: Visit[]; active: Visit | null; notes: string; setNotes: (value: string) => void;
  onCheckIn: (merchantId: string) => void; onCheckOut: () => void; busy: boolean; loading: boolean; error: string | null; retry: () => void;
}) {
  const [filter, setFilter] = useState<'today' | 'all'>('today');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [route, setRoute] = useState('');
  const routes = [...new Set([...MERCHANT_ROUTES, ...merchants.map(merchant => merchant.route_name).filter((name): name is string => !!name)])];
  const visibleMerchants = merchants.filter(merchant => (!route || merchant.route_name === route) && `${merchant.name} ${merchant.merchant_code}`.toLowerCase().includes(search.trim().toLowerCase()));
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const today = visits.filter(v => new Date(v.check_in_at).toDateString() === new Date(now).toDateString());
  const selected = visits.find(v => v.id === selectedId) || active;
  const merchant = merchants.find(m => m.id === selected?.merchant_id);
  const duration = selected ? Math.max(0, Math.floor(((selected.check_out_at ? new Date(selected.check_out_at).getTime() : now) - new Date(selected.check_in_at).getTime()) / 1000)) : 0;
  const time = (value: string | null | undefined) => value ? formatDateTime(value) : '—';
  const mapLat = selected?.check_in_latitude ?? merchant?.latitude;
  const mapLng = selected?.check_in_longitude ?? merchant?.longitude;
  return <section className="field-visits">
    <header><div><h1>{uiText("Visits &amp; Check-in")}</h1><p>{uiText("Track field visits, check-ins and activity for your merchants")}</p></div></header>
    <div className="fv-stats">{[
      { title: "Today's Visits", value: today.length, Icon: CalendarDays },
      { title: 'Completed Today', value: today.filter(v => v.status === 'completed').length, Icon: CheckCircle2 },
      { title: 'In Progress', value: visits.filter(v => v.status === 'active').length, Icon: MapPin },
      { title: 'Merchants Available', value: merchants.length, Icon: Store },
    ].map(({ title, value, Icon }) => <div key={title}><Icon /><strong>{value}</strong><span>{title}</span></div>)}</div>
    {loading && <p role="status">{uiText("Loading visit history…")}</p>}
    {error && <p role="alert">{error} <button onClick={retry}>{uiText("Retry")}</button></p>}
    <div className="fv-grid"><div className="fv-panel">
      <div className="fv-tabs"><button aria-pressed={filter === 'today'} onClick={() => setFilter('today')}>{uiText("Today's Visits (")}{today.length})</button><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{uiText("All Visits")}</button></div>
      <div className="fv-history">{(filter === 'today' ? today : visits).map(v => <button className={`fv-visit ${selected?.id === v.id ? 'selected' : ''}`} key={v.id} onClick={() => setSelectedId(v.id)}><MapPin /><div><strong>{v.merchants?.name || merchants.find(m => m.id === v.merchant_id)?.name || 'Merchant'}</strong><small>{time(v.check_in_at)}</small></div><span className={`fv-badge ${v.status}`}>{v.status === 'active' ? uiText("In Progress") : v.status}</span></button>)}{!(filter === 'today' ? today : visits).length && !loading && <p className="fv-empty">{uiText("No visits recorded ")}{filter === 'today' ? uiText("today") : uiText("yet")}.</p>}</div>
      <h2>{uiText("Start a merchant visit")}</h2><input aria-label={uiText("Search merchants for check-in")} placeholder={uiText("Search merchants…")} value={search} onChange={e => setSearch(e.target.value)} />
      <label style={{ display: 'grid', gap: 8, margin: '14px 0' }}>{uiText('Route')}<select value={route} onChange={event => setRoute(event.target.value)} style={{ width: '100%', padding: 12, borderRadius: 12 }}><option value="">{uiText('All routes')}</option>{routes.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      <div className="fv-merchants">{visibleMerchants.map(m => <div className="fv-merchant" key={m.id}>{m.image_url ? <img src={m.image_url} alt="" /> : <Store />}<div><strong>{m.name}</strong><small>{m.merchant_code} · {m.distance == null ? uiText("Location unavailable") : `${Math.round(m.distance)} m away`}</small></div><button disabled={busy} onClick={() => { setSelectedId(null); onCheckIn(m.id); }}>{uiText("Open Visit")}</button></div>)}</div>
      {!visibleMerchants.length && <p className="fv-empty">{uiText('No merchants match this route and search.')}</p>}
    </div><aside className="fv-panel fv-activity"><h2>{uiText("Check-in Activity")}</h2>{selected ? <>
      <div className="fv-activity-name"><Store /><div><strong>{selected.merchants?.name || merchant?.name || 'Merchant'}</strong><small>{selected.merchants?.merchant_code || merchant?.merchant_code}</small></div><span className={`fv-badge ${selected.status}`}>{selected.status === 'active' ? uiText("Checked In") : uiText("Completed")}</span></div>
      <dl><dt>{uiText("Check-in Time")}</dt><dd>{time(selected.check_in_at)}</dd><dt>{uiText("Location")}</dt><dd>{merchant?.address || 'No address saved'}</dd><dt>{uiText("Check-out Time")}</dt><dd>{time(selected.check_out_at)}</dd><dt>{uiText("Duration")}</dt><dd>{Math.floor(duration / 3600)}h {Math.floor(duration % 3600 / 60)}m {duration % 60}s</dd><dt>{uiText("GPS Accuracy")}</dt><dd>{selected.accuracy_m == null ? uiText("Unavailable") : `±${Math.round(selected.accuracy_m)} m`}</dd><dt>{uiText("Distance at Check-in")}</dt><dd>{selected.distance_m == null ? uiText("Unavailable") : `${Math.round(selected.distance_m)} m`}</dd><dt>{uiText("GPS Coordinates")}</dt><dd>{mapLat != null && mapLng != null ? `${mapLat}, ${mapLng}` : uiText("Unavailable")}</dd></dl>
      {mapLat != null && mapLng != null && <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps?q=${mapLat},${mapLng}`}>{uiText("View on Map ↗")}</a>}
      {selected.id === active?.id ? <><p>{uiText("Record notes, problems, feedback and follow-up details in the visit report. Review everything before ending the visit.")}</p><button className="fv-checkout" disabled={busy} onClick={onCheckOut}><MapPin size={18} />{busy ? uiText("Opening…") : uiText("Open Visit Report")}</button></> : <><h3>{uiText("Visit Notes")}</h3><p>{selected.notes || 'No notes recorded.'}</p></>}
    </> : <p className="fv-empty">{uiText("Select a recorded visit or check in at a merchant to view activity.")}</p>}</aside></div>
    <p className="fv-footnote">{uiText("Check-in uses your browser GPS. The server validates the 50-metre merchant radius. No planned or missed visits are invented.")}</p>
  </section>;
}
