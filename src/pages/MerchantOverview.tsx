import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from '../components/Common';
import type { Order, UserProfile } from '../types';
import { formatCurrency } from '../utils';
import './merchant-overview.css';

async function loadOrders(signal: AbortSignal) {
  const orders: Order[] = [];
  for (let page = 1; ; page++) {
    const result = await apiFetch<{ orders: Order[]; pagination: { totalPages: number } }>(`/api/orders?page=${page}&pageSize=100`, { signal });
    orders.push(...result.orders);
    if (page >= result.pagination.totalPages || !result.orders.length) return orders;
  }
}
const indiaDate = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));

export function MerchantOverview({ user }: { user: UserProfile }) {
  const [tab, setTab] = useState('Overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState('');
  const [month, setMonth] = useState(indiaDate(new Date().toISOString()).slice(0, 7));
  const query = useQuery({ queryKey: ['merchant-overview', user.merchant_id], queryFn: ({ signal }) => loadOrders(signal), staleTime: 60000 });
  const model = useMemo(() => {
    const orders = query.data || [];
    const groups = new Map<string, Order[]>();
    orders.forEach(o => { const key = o.cid || o.phone; groups.set(key, [...(groups.get(key) || []), o]); });
    const customers = [...groups].map(([id, visits]) => ({ id, name: visits[0].customer || 'Customer', phone: visits[0].phone, visits, spend: visits.reduce((n, o) => n + o.amount, 0), first: visits[visits.length - 1].timestamp }));
    const current = orders.filter(o => indiaDate(o.timestamp).startsWith(month));
    const active = customers.filter(c => c.visits.some(o => indiaDate(o.timestamp).startsWith(month)));
    const returning = active.filter(c => c.visits.length >= 2);
    const loyal = active.filter(c => c.visits.length >= 3);
    const sales = current.reduce((n, o) => n + o.amount, 0);
    const heat = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
    current.forEach(o => { const d = new Date(new Date(o.timestamp).getTime() + 330 * 60000); heat[(d.getUTCDay() + 6) % 7][Math.floor(d.getUTCHours() / 6)]++; });
    return { customers, current, active, returning, loyal, sales, heat };
  }, [query.data, month]);
  const profile = model.customers.find(c => c.id === selected);
  function exportReport() {
    const lines = [['Month', 'Sales (INR)', 'Recorded purchases', 'Active customers', 'Repeat customers', 'Loyal customers'], [month, model.sales, model.current.length, model.active.length, model.returning.length, model.loyal.length]];
    const url = URL.createObjectURL(new Blob([lines.map(r => r.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `AE-report-${month}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  return <div className="merchant-overview">
    <header className="mo-heading"><div><h1>Your business at a glance</h1><p>Know your customers. Build lasting relationships.</p></div><label>Reporting month<input aria-label="Reporting month" type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} /></label></header>
    <nav className="mo-tabs" aria-label="Merchant sections">{['Overview', 'Customers', 'Insights', 'Reports'].map(t => <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}>{t}</button>)}<Link to="/offers?create=1">Create offer</Link><Link to="/feedback">Reviews</Link><Link to="/more">Settings</Link></nav>
    {tab === 'Overview' && <>
      <div className="mo-stats">{[['Active customers', model.active.length], ['Returning customers', model.returning.length], ['New purchasing customers', model.active.filter(c => indiaDate(c.first).startsWith(month)).length], ['Total sales', formatCurrency(model.sales)]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>Selected month</small></article>)}</div>
      <div className="mo-columns"><section className="mo-panel"><h2>Customer growth</h2><p>Distinct purchasing customers by day</p><div className="mo-growth">{Array.from({ length: new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() }, (_, i) => { const day = `${month}-${String(i + 1).padStart(2, '0')}`; const count = new Set(model.current.filter(o => indiaDate(o.timestamp) === day).map(o => o.cid || o.phone)).size; return <div key={day} title={`${day}: ${count} customers`}><span style={{ height: `${Math.max(2, count / Math.max(1, model.active.length) * 140)}px` }} /><small>{i + 1}</small></div>; })}</div></section>
      <section className="mo-panel"><h2>Quick insights</h2><p>{model.active.length ? Math.round(model.returning.length / model.active.length * 100) : 0}% of active customers have returned.</p><p>Average purchase: <strong>{formatCurrency(model.current.length ? model.sales / model.current.length : 0)}</strong></p><p>{model.current.length} recorded purchases this month.</p><Link to="/add-customer" className="button primary">Record a purchase</Link></section></div>
      <div className="mo-columns"><section className="mo-panel"><h2>Your business health</h2><div className="mo-health">{[['Customer reach', `${model.active.length} active customers`], ['Repeat visits', `${model.returning.length} returning customers`], ['Sales', formatCurrency(model.sales)], ['Customer value', `${formatCurrency(model.active.length ? model.sales / model.active.length : 0)} per active customer`], ['Loyalty', `${model.loyal.length} customers with 3+ purchases`]].map(([a, b]) => <article key={a}><strong>{a}</strong><p>{b}</p></article>)}</div></section>
      <section className="mo-panel"><h2>Customer journey</h2>{[['First visit', model.active.filter(c => c.visits.length === 1).length], ['Repeat customer', model.active.filter(c => c.visits.length === 2).length], ['Loyal customer', model.loyal.length]].map(([a, b]) => <p className="mo-journey" key={a}><span>{a}</span><strong>{b}</strong></p>)}<p>Stages use recorded lifetime purchases for customers active this month.</p><Link to="/offers?create=1" className="button primary">Bring customers back with an offer</Link></section></div>
    </>}
    {tab === 'Customers' && <section className="mo-panel"><h2>Know your customers</h2><p>Customers with recorded purchases. <Link to="/customers">View all registered customers and QR codes</Link></p><input aria-label="Search customers" placeholder="Search name or phone" value={search} onChange={e => setSearch(e.target.value)} /><div className="mo-tabs">{['All', 'Returning', 'New'].map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}</div>{model.customers.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || (filter === 'Returning' ? c.visits.length > 1 : c.visits.length === 1))).map(c => <button className="mo-customer" key={c.id} onClick={() => setSelected(c.id)}><span><strong>{c.name}</strong><small>{c.visits.length} purchases</small></span><strong>{formatCurrency(c.spend)}</strong></button>)}{!model.customers.length && <p>No recorded customer purchases yet.</p>}</section>}
    {tab === 'Insights' && <section className="mo-panel"><h2>When customers visit</h2><p>Recorded purchases by weekday and time, in India Standard Time.</p><div className="mo-heat"><span />{['Night 00–06', 'Morning 06–12', 'Afternoon 12–18', 'Evening 18–24'].map(t => <strong key={t}>{t}</strong>)}{model.heat.map((row, i) => <div className="mo-heat-row" key={i}><strong>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</strong>{row.map((n, j) => <span key={j} style={{ background: n ? '#dbeafe' : 'var(--surface-alt)' }} aria-label={`${n} purchases`}>{n}</span>)}</div>)}</div>{!model.current.length && <p>No purchases recorded for this month.</p>}</section>}
    {tab === 'Reports' && <section className="mo-panel"><h2>Business reports</h2><p>Download the selected month’s sales and customer summary.</p><button className="button primary" onClick={exportReport}>Download monthly CSV</button><h3>Top customers — lifetime spending</h3>{[...model.customers].sort((a, b) => b.spend - a.spend).slice(0, 10).map(c => <button className="mo-customer" key={c.id} onClick={() => setSelected(c.id)}><span>{c.name}</span><strong>{formatCurrency(c.spend)}</strong></button>)}<Link to="/orders">View transactions and order exports</Link></section>}
    {profile && <div className="modal-backdrop" onClick={() => setSelected('')}><section className="modal mo-profile" role="dialog" aria-modal="true" aria-label="Customer profile" onClick={e => e.stopPropagation()}><button className="button secondary" onClick={() => setSelected('')}>Close</button><h2>{profile.name}</h2><p>{profile.visits.length >= 3 ? 'Loyal customer' : profile.visits.length > 1 ? 'Returning customer' : 'New customer'}</p><p>{profile.visits.length} recorded purchases · {formatCurrency(profile.spend)} total spending</p><a className="button secondary" href={`tel:${profile.phone}`}>Call customer</a><h3>Purchase history</h3>{profile.visits.map(o => <p className="mo-journey" key={o.id}><span>{indiaDate(o.timestamp)} · {o.orderNo}</span><strong>{formatCurrency(o.amount)}</strong></p>)}<Link to="/offers?create=1" className="button primary">Create an offer</Link></section></div>}
  </div>;
}
