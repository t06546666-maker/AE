import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, ChevronRight, Crown, Download, Gift, Heart, IndianRupee, Lightbulb, Mail, Phone, Plus, RefreshCw, Search, TrendingUp, Users, UserPlus, X } from 'lucide-react';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from '../components/Common';
import type { Customer, Order, Pagination, UserProfile } from '../types';
import { formatCurrency, formatPhone, initials } from '../utils';
import { buildMerchantAnalytics, changePercent, indiaDate, type MerchantAnalytics, type MerchantCustomer } from './merchantAnalytics';
import './merchant-overview.css';

async function loadPages<T>(resource: 'orders' | 'customers', signal: AbortSignal): Promise<T[]> {
  const fetchPage = (page: number) => apiFetch<Record<string, T[]> & { pagination: Pagination }>(`/api/${resource}?page=${page}&pageSize=100`, { signal });
  const first = await fetchPage(1);
  const rows = [...first[resource]];
  // Bounded batches avoid a serial waterfall without flooding the API.
  for (let page = 2; page <= first.pagination.totalPages; page += 4) {
    const batch = await Promise.all(Array.from({ length: Math.min(4, first.pagination.totalPages - page + 1) }, (_, i) => fetchPage(page + i)));
    batch.forEach(result => rows.push(...result[resource]));
  }
  return rows;
}

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
const series = [{ key: 'total', label: 'Total', color: '#1875eb' }, { key: 'fresh', label: 'New', color: '#16a078' }, { key: 'returning', label: 'Returning', color: '#d58a13' }] as const;
const stage = (count: number) => count >= 3 ? 'Loyal customer' : count >= 2 ? 'Returning customer' : count === 1 ? 'First-time customer' : 'No purchases yet';

function Change({ value, previous, label }: { value: number; previous: number; label: string }) {
  const change = changePercent(value, previous);
  return <small className={`mo-change ${change === null || change === 0 ? 'neutral' : change > 0 ? 'positive' : 'negative'}`}>
    {change !== null && change !== 0 && (change > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
    {change === null ? (value ? 'No previous baseline' : 'No activity in either period') : `${change > 0 ? '+' : ''}${change}% ${label}`}
  </small>;
}

function GrowthChart({ model }: { model: MerchantAnalytics }) {
  const [day, setDay] = useState<number | null>(null);
  const points = model.growth;
  const selected = points[Math.min(day ?? points.length - 1, points.length - 1)];
  const top = Math.max(4, Math.ceil(model.current.active.length / 4) * 4);
  const x = (i: number) => 38 + i / Math.max(1, points.length - 1) * 530;
  const y = (n: number) => 174 - n / top * 150;
  return <section className="mo-panel mo-growth-panel">
    <div className="mo-panel-heading"><div><h2>Customer growth</h2><p>New and returning customers, month to date</p></div><span className="mo-icon blue"><TrendingUp size={20} /></span></div>
    <div className="mo-chart-values" aria-live="polite"><span>Day {selected.day}</span>{series.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label} <strong>{selected[s.key]}</strong></span>)}</div>
    <svg className="mo-chart" viewBox="0 0 600 208" role="img" aria-label="Cumulative distinct purchasing customers: total, new and returning. Use the day slider below for exact counts.">
      <defs><linearGradient id="mo-growth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1875eb" stopOpacity=".15" /><stop offset="100%" stopColor="#1875eb" stopOpacity="0" /></linearGradient></defs>
      {Array.from({ length: 5 }, (_, i) => <g key={i}><line x1="38" x2="574" y1={y(top * i / 4)} y2={y(top * i / 4)} className="mo-grid-line" /><text x="29" y={y(top * i / 4) + 4} textAnchor="end">{top * i / 4}</text></g>)}
      <path d={`M38,174 ${points.map((p, i) => `L${x(i)},${y(p.total)}`).join(' ')} L${x(points.length - 1)},174 Z`} fill="url(#mo-growth-fill)" />
      {series.map(s => <polyline key={s.key} points={points.map((p, i) => `${x(i)},${y(p[s.key])}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
      <line x1={x(selected.day - 1)} x2={x(selected.day - 1)} y1="18" y2="174" stroke="#94a3b8" strokeDasharray="3 4" />
      {series.map(s => <circle key={s.key} cx={x(selected.day - 1)} cy={y(selected[s.key])} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
      {points.filter((p, i) => i === 0 || i === points.length - 1 || p.day % 5 === 0 && i < points.length - 2).map(p => <text key={p.day} x={x(p.day - 1)} y="197" textAnchor="middle">{p.day}</text>)}
    </svg>
    <label className="mo-chart-slider">Explore a day<input aria-label="Customer growth day" type="range" min="1" max={points.length} value={selected.day} onChange={e => setDay(Number(e.target.value) - 1)} /></label>
    <details className="mo-definitions"><summary>How are customers counted?</summary><p>Each customer is counted once in the selected month. New means their first recorded purchase was this month; returning means they purchased before this month. The lines accumulate through each day. Total = new + returning. A recorded purchase is used as a visit.</p></details>
  </section>;
}

function CustomerProfile({ customer, onClose }: { customer: MerchantCustomer; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={dialog} className="mo-profile" aria-labelledby="mo-profile-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="mo-profile-inner"><header className="mo-profile-top"><h2 id="mo-profile-title">Customer profile</h2><button className="mo-close" aria-label="Close customer profile" onClick={onClose}><X size={22} /></button></header>
      <div className="mo-profile-person"><span className="mo-avatar violet">{initials(customer.name)}</span><div><h3>{customer.name}</h3><span className="mo-badge">{customer.visits.length >= 3 && <Crown size={13} />}{stage(customer.visits.length)}</span></div></div>
      <div className="mo-contact">{customer.phone && <a href={`tel:${customer.phone}`}><Phone size={19} /><span>Call</span></a>}{customer.email && <a href={`mailto:${customer.email}`}><Mail size={19} /><span>Email</span></a>}<Link to="/offers?create=1"><Gift size={19} /><span>Create offer</span></Link></div>
      <div className="mo-profile-stats"><div><strong>{customer.visits.length}</strong><small>Recorded visits</small></div><div><strong>{formatCurrency(customer.spend)}</strong><small>Total spent</small></div><div><strong>{customer.joined ? dateLabel(customer.joined) : '—'}</strong><small>Customer since</small></div></div>
      <p className="mo-note">Lifetime activity at your business • {formatPhone(customer.phone)}</p><h3 className="mo-history-title">Visit history</h3>
      <div className="mo-history">{customer.visits.map(o => <div key={o.id}><span className="mo-history-icon"><CalendarDays size={17} /></span><span><strong>{dateLabel(o.timestamp)}</strong><small>{o.orderNo}</small></span><b>{formatCurrency(o.amount)}</b></div>)}{!customer.visits.length && <p className="mo-empty">No purchases recorded yet.</p>}</div>
      <p className="mo-note">Offers use your existing offer workflow; they are not sent privately from this profile.</p>
    </div>
  </dialog>;
}

function VisitHeatmap({ model }: { model: MerchantAnalytics }) {
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(1, ...model.heat.flat());
  return <><div className="mo-heat" role="group" aria-label="Purchase activity by weekday and three-hour period in India Standard Time"><span />{['00–03', '03–06', '06–09', '09–12', '12–15', '15–18', '18–21', '21–24'].map(time => <span className="mo-heat-time" key={time}>{time}</span>)}{model.heat.map((row, i) => <div className="mo-heat-row" key={i}><span>{weekdays[i].slice(0, 3)}</span>{row.map((count, j) => { const label = `${weekdays[i]}, ${String(j * 3).padStart(2, '0')}:00–${String((j + 1) * 3).padStart(2, '0')}:00 IST: ${count} recorded purchases`; return <button key={j} aria-label={label} title={label} data-level={count ? Math.max(1, Math.ceil(count / max * 4)) : 0} onClick={() => setSelected(label)}>{count || <span aria-hidden="true">·</span>}</button>; })}</div>)}</div><div className="mo-heat-key"><span>Less</span>{[0, 1, 2, 3, 4].map(n => <i key={n} data-level={n} />)}<span>More</span><span>India Standard Time</span></div><p className="mo-note" aria-live="polite">{selected || 'Tap a cell to see the exact time and purchase count.'}</p><div className="mo-insight-banner"><Lightbulb size={20} /><p>{model.busiestDay >= 0 ? `${weekdays[model.busiestDay]} is your busiest day this month. Plan your offers around your busiest times.` : 'Your busiest times will appear after you record customer purchases.'}</p></div></>;
}

export function MerchantOverview({ user }: { user: UserProfile }) {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const view = location.pathname === '/customers' ? 'customers' : ['insights', 'reports'].includes(params.get('view') || '') ? params.get('view')! : 'overview';
  const currentMonth = indiaDate(new Date()).slice(0, 7);
  const requestedMonth = params.get('month') || currentMonth;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) && requestedMonth <= currentMonth && requestedMonth >= '2000-01' ? requestedMonth : currentMonth;
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [filter, setFilter] = useState('All');
  const [insight, setInsight] = useState('Visits');
  const [customerPage, setCustomerPage] = useState(1);
  const [downloaded, setDownloaded] = useState('');
  const query = useQuery({ queryKey: ['merchant-overview', user.id, user.merchant_id], queryFn: async ({ signal }) => {
    const [orders, customers] = await Promise.all([loadPages<Order>('orders', signal), loadPages<Customer>('customers', signal)]);
    return { orders, customers };
  }, staleTime: 60_000 });
  const model = useMemo(() => buildMerchantAnalytics(query.data?.orders || [], query.data?.customers || [], month), [query.data, month]);
  const { current, previous } = model;
  const profile = model.customers.find(c => c.id === params.get('customer'));
  const filtered = model.customers.filter(c => `${c.name} ${c.phone} ${c.id}`.toLowerCase().includes(deferredSearch) && (filter === 'All' || (filter === 'Returning' ? c.visits.length >= 2 : filter === 'New' ? c.visits.length === 1 : c.visits.length === 0)));
  useEffect(() => setCustomerPage(1), [deferredSearch, filter]);
  const href = (section: string) => section === 'customers' ? `/customers?month=${month}` : `/dashboard?view=${section}&month=${month}`;
  function selectCustomer(id: string | null) { const next = new URLSearchParams(params); if (id) next.set('customer', id); else next.delete('customer'); setParams(next, { replace: !id }); }
  function exportReport(kind: string) {
    const summary = [['Month', 'Sales (INR)', 'Recorded visits', 'Purchasing customers', 'New customers', 'Returning customers', 'Average purchase (INR)'], [month, current.sales, current.orders.length, current.active.length, current.fresh.length, current.returning.length, current.average]];
    const customers = [['Customer ID', 'Name', 'Recorded visits (lifetime)', 'Total spent (INR, lifetime)'], ...model.customers.map(c => [c.id, c.name, c.visits.length, c.spend])];
    const frequency = [['Weekday', 'Start hour (IST)', 'End hour (IST)', 'Recorded purchases'], ...model.heat.flatMap((row, i) => row.map((n, j) => [weekdays[i], j * 3, (j + 1) * 3, n]))];
    const comparison = [['Metric', month, model.priorMonth], ['Purchasing customers', current.active.length, previous.active.length], ['Sales (INR)', current.sales, previous.sales], ['Recorded visits', current.orders.length, previous.orders.length], ['Comparison', model.comparisonLabel, '']];
    const rows = kind === 'customers' ? customers : kind === 'visits' ? frequency : kind === 'comparison' ? comparison : summary;
    const escape = (value: string | number) => { const text = String(value); return `"${(typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`; };
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `AE-${kind}-${month}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded('CSV export requested.');
  }
  if (query.isPending) return <div className="merchant-overview"><LoadingState label="Loading your business activity…" /></div>;
  if (query.isError) return <div className="merchant-overview"><ErrorState error={query.error} retry={() => query.refetch()} /></div>;
  const percent = (n: number) => current.active.length ? Math.round(n / current.active.length * 100) : 0;
  const metrics = [
    { label: 'Total customers', value: current.active.length, before: previous.active.length, icon: Users, color: 'blue', hint: 'Purchased this month' },
    { label: 'Returning customers', value: current.returning.length, before: previous.returning.length, icon: RefreshCw, color: 'green', hint: 'Purchased in an earlier month' },
    { label: 'New customers', value: current.fresh.length, before: previous.fresh.length, icon: UserPlus, color: 'pink', hint: 'First purchase this month' },
    { label: 'Total sales', value: current.sales, before: previous.sales, icon: IndianRupee, color: 'amber', hint: 'Recorded purchase value' },
  ];
  return <div className="merchant-overview">
    <header className="mo-heading"><div><span className="mo-eyebrow">YOUR BUSINESS, CLOSER</span><h1>{view === 'overview' ? `Hello, ${user.full_name || 'there'}` : view === 'customers' ? 'Your customers' : view === 'insights' ? 'Customer insights' : 'Business reports'}</h1><p>{view === 'customers' ? 'Every relationship starts with knowing your customer.' : 'Know your customers. Keep them coming back.'}</p></div><div className="mo-heading-actions">{view !== 'customers' && <label className="mo-month"><CalendarDays size={17} /><span>{new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span><input aria-label="Reporting month" type="month" min="2000-01" max={currentMonth} value={month} onChange={e => { if (e.target.value) { const next = new URLSearchParams(params); next.set('month', e.target.value); setParams(next, { replace: true }); } }} /></label>} {view === 'overview' && <div className="mo-header-actions"><Link to="/add-customer" className="mo-header-action add">+ <span>Add customer</span></Link><Link to="/rewards" className="mo-header-action scan">⌁ <span>Scan QR</span></Link></div>}</div></header>
    <nav className="mo-tabs" aria-label="Business dashboard sections">{[['overview', 'Overview'], ['customers', 'Customers'], ['insights', 'Insights'], ['reports', 'Reports']].map(([id, label]) => <Link key={id} to={href(id)} aria-current={view === id ? 'page' : undefined}>{label}</Link>)}<Link className="mo-create-link" to="/offers?create=1"><Plus size={16} />Create offer</Link></nav>
    <div className="mo-content" key={view}>
    {view === 'overview' && <>
      <div className="mo-stats">{metrics.map(({ label, value, before, icon: Icon, color, hint }) => <article key={label} className={`mo-stat ${color}`}><div className="mo-stat-label"><span className={`mo-icon ${color}`}><Icon size={21} /></span><span>{label}</span></div><strong className="mo-stat-value">{label === 'Total sales' ? formatCurrency(value) : value.toLocaleString('en-IN')}</strong><span className="mo-stat-hint">{hint}</span><Change value={value} previous={before} label={model.comparisonLabel} /></article>)}</div>
      <div className="mo-columns"><GrowthChart key={month} model={model} /><section className="mo-panel"><div className="mo-panel-heading"><div><h2>Quick insights</h2><p>Small insights. Better decisions.</p></div><Lightbulb size={21} /></div><div className="mo-quick-list">
        <div><span className="mo-icon green"><RefreshCw size={20} /></span><p><strong>{percent(current.returning.length)}% returned</strong><small>Had purchased before this month</small></p></div>
        <div><span className="mo-icon violet"><IndianRupee size={20} /></span><p><strong>{formatCurrency(current.average)}</strong><small>Average spend per recorded visit</small></p></div>
        <div><span className="mo-icon pink"><CalendarDays size={20} /></span><p><strong>{model.busiestDay >= 0 ? weekdays[model.busiestDay] : 'No visits yet'}</strong><small>{model.busiestDay >= 0 ? 'Your busiest day this month' : 'Record a purchase to get started'}</small></p></div>
        <div><span className="mo-icon blue"><BarChart3 size={20} /></span><p><strong>{current.orders.length.toLocaleString('en-IN')} visits</strong><small>Based on recorded purchases</small></p></div>
      </div><Link to="/add-customer" className="mo-primary"><Plus size={18} />Record a purchase</Link></section></div>
      <div className="mo-columns"><section className="mo-panel"><h2>Your business health</h2><p className="mo-subtitle">Five things that matter, measured against last month.</p><div className="mo-health">{[
        { title: 'Customer reach', value: current.active.length, before: previous.active.length, text: `${current.active.length} purchasing customers`, icon: Users, color: 'green' },
        { title: 'Repeat visits', value: current.repeat.length, before: previous.repeat.length, text: `${current.repeat.length} customers with 2+ recorded visits`, icon: RefreshCw, color: 'blue' },
        { title: 'Sales', value: current.sales, before: previous.sales, text: `${formatCurrency(current.sales)} recorded sales`, icon: BarChart3, color: 'violet' },
        { title: 'Customer value', value: current.average, before: previous.average, text: `${formatCurrency(current.average)} average per visit`, icon: IndianRupee, color: 'amber' },
        { title: 'Loyalty', value: current.loyal.length, before: previous.loyal.length, text: `${current.loyal.length} customers with 3+ recorded visits`, icon: Heart, color: 'pink' },
      ].map(({ title, value, before, text, icon: Icon, color }) => <div className={`mo-health-row ${color}`} key={title}><span className={`mo-icon ${color}`}><Icon size={22} /></span><div><h3>{title}</h3><p>{text}</p><Change value={value} previous={before} label={model.comparisonLabel} /></div></div>)}</div></section>
      <section className="mo-panel"><h2>Customer journey</h2><p className="mo-subtitle">From their first visit to a lasting relationship.</p><ol className="mo-journey">{[
        { title: 'First visit', number: current.fresh.length, text: 'customers made their first purchase this month', icon: UserPlus, color: 'blue' },
        { title: 'Repeat visit', number: current.repeat.length, text: 'active customers have made 2+ purchases', icon: RefreshCw, color: 'green' },
        { title: 'Loyal customer', number: current.loyal.length, text: 'active customers have made 3+ purchases', icon: Crown, color: 'amber' },
      ].map(({ title, number, text, icon: Icon, color }, i) => <li key={title}><span className={`mo-icon ${color}`}><Icon size={24} /></span><div><small>0{i + 1} / {title}</small><strong>{number.toLocaleString('en-IN')}</strong><p>{text}</p></div></li>)}</ol><p className="mo-note">Repeat and loyal stages overlap. Visit counts stop at the selected period’s end.</p><div className="mo-insight-banner pink"><Heart size={22} /><p>Happy customers. Growing business.<br /><Link to="/offers?create=1">Create your next offer <ArrowRight size={14} /></Link></p></div></section></div>
      <section className="mo-panel mo-tools"><div><h2>Keep your business moving</h2><p>All your everyday tools, one tap away.</p></div><div className="mo-tool-grid">{[{ to: '/offers?create=1', title: 'Create offers', icon: Gift, color: 'pink' }, { to: href('customers'), title: 'Know customers', icon: Users, color: 'violet' }, { to: href('insights'), title: 'Track growth', icon: TrendingUp, color: 'amber' }, { to: href('reports'), title: 'Get reports', icon: BarChart3, color: 'blue' }].map(({ to, title, icon: Icon, color }) => <Link to={to} key={title}><span className={`mo-icon ${color}`}><Icon size={24} /></span><strong>{title}</strong><ChevronRight size={16} /></Link>)}</div></section>
    </>}
    {view === 'customers' && <section className="mo-panel mo-customer-panel"><div className="mo-panel-heading"><div><h2>Customer list <span className="mo-count">{model.customers.length}</span></h2><p>All linked customers • lifetime activity at your business</p></div><Link to="/add-customer" className="mo-close" aria-label="Add customer"><UserPlus size={21} /></Link></div><label className="mo-search"><Search size={19} /><input aria-label="Search customers" placeholder="Search name, phone or customer ID" value={search} onChange={e => setSearch(e.target.value)} />{search && <button onClick={() => setSearch('')} aria-label="Clear customer search"><X size={17} /></button>}</label><div className="mo-segmented" aria-label="Filter customers">{['All', 'Returning', 'New', 'No visits'].map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f} <span>{model.customers.filter(c => f === 'All' || (f === 'Returning' ? c.visits.length >= 2 : f === 'New' ? c.visits.length === 1 : !c.visits.length)).length}</span></button>)}</div><p className="mo-note">New: one recorded visit. Returning: two or more. Customers without purchases are included.</p><div className="mo-customer-list">{filtered.slice((customerPage - 1) * 20, customerPage * 20).map((c, index) => <button className="mo-customer" key={c.id} onClick={() => selectCustomer(c.id)}><span className={`mo-avatar ${['violet', 'blue', 'amber', 'green'][index % 4]}`}>{initials(c.name)}</span><span className="mo-customer-name"><strong>{c.name}</strong><small>{c.visits.length} {c.visits.length === 1 ? 'visit' : 'visits'}{c.visits.length >= 3 && ' · Loyal'}</small></span><span className="mo-customer-spend"><strong>{formatCurrency(c.spend)}</strong><small>Total spent</small></span><ChevronRight size={17} /></button>)}</div>{!filtered.length && <div className="mo-empty"><Users size={28} /><h3>{search || filter !== 'All' ? 'No matching customers' : 'Your relationships start here'}</h3><p>{search || filter !== 'All' ? 'Try another search or customer filter.' : 'Add your first customer to start tracking their visits.'}</p></div>}{filtered.length > 20 && <div className="mo-pagination"><button disabled={customerPage === 1} onClick={() => setCustomerPage(p => p - 1)}>Previous</button><span>{customerPage} / {Math.ceil(filtered.length / 20)}</span><button disabled={customerPage * 20 >= filtered.length} onClick={() => setCustomerPage(p => p + 1)}>Next</button></div>}</section>}
    {view === 'insights' && <section className="mo-panel"><div className="mo-panel-heading"><div><h2>Understand your customers</h2><p>Patterns from recorded purchases in the selected month.</p></div><TrendingUp size={22} /></div><div className="mo-segmented">{['Visits', 'Spending', 'Retention'].map(t => <button key={t} aria-pressed={insight === t} onClick={() => setInsight(t)}>{t}</button>)}</div>{insight === 'Visits' ? <><h3 className="mo-section-title">When customers visit</h3><VisitHeatmap key={month} model={model} /></> : insight === 'Spending' ? <><h3 className="mo-section-title">Who contributes to your sales?</h3>{[{ label: 'New customers', value: model.newSpend, color: '#16a078' }, { label: 'Returning customers', value: model.returningSpend, color: '#1875eb' }].map(s => <div className="mo-spend-row" key={s.label}><div><span>{s.label}</span><strong>{formatCurrency(s.value)}</strong></div><div className="mo-progress"><span style={{ width: `${current.sales ? s.value / current.sales * 100 : 0}%`, background: s.color }} /></div></div>)}<p className="mo-note">Average recorded purchase: {formatCurrency(current.average)}. New/returning uses the same monthly cohorts as the growth chart.</p></> : <><h3 className="mo-section-title">Customers who come back</h3><div className="mo-retention"><strong>{percent(current.returning.length)}%</strong><p>of this month’s purchasing customers had bought from you in an earlier month.</p></div><p className="mo-note">{current.returning.length} returning out of {current.active.length} purchasing customers. This is a returning-customer share, not a cohort retention rate.</p><Link to="/offers?create=1" className="mo-primary"><Gift size={18} />Create an offer</Link></>}{!current.orders.length && <p className="mo-empty">No purchases recorded in this month.</p>}</section>}
    {view === 'reports' && <section className="mo-panel"><h2>Simple reports. Clear decisions.</h2><p className="mo-subtitle">Export your data as CSV for Excel or Google Sheets.</p><div className="mo-report-list">{[{ kind: 'summary', title: 'Customer & sales summary', detail: 'Selected month’s sales and customer totals', icon: Users, color: 'blue' }, { kind: 'visits', title: 'Visit frequency', detail: 'Weekdays and times your customers visit', icon: BarChart3, color: 'violet' }, { kind: 'customers', title: 'Top customers', detail: 'All customers, ranked by lifetime spending', icon: Crown, color: 'amber' }, { kind: 'comparison', title: 'Monthly comparison', detail: model.comparisonLabel, icon: TrendingUp, color: 'green' }].map(({ kind, title, detail, icon: Icon, color }) => <button key={kind} onClick={() => exportReport(kind)}><span className={`mo-icon ${color}`}><Icon size={22} /></span><span><strong>{title}</strong><small>{detail}</small></span><Download size={19} /></button>)}</div><p className="mo-note" role="status">{downloaded}</p><Link to="/orders" className="mo-primary">View purchase history <ArrowRight size={18} /></Link></section>}
    </div>
    {view === 'customers' && <Link className="mo-qr-link" to="/customers?view=qr">Open customer QR codes and existing tools <ChevronRight size={16} /></Link>}
    {profile && <CustomerProfile key={profile.id} customer={profile} onClose={() => selectCustomer(null)} />}
  </div>;
}
