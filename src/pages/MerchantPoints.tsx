import { uiText } from '../uiText';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Coins } from 'lucide-react';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from '../components/Common';
import type { UserProfile } from '../types';
import { rangeForChartPeriod } from '../utils';
import { indiaDate } from './merchantAnalytics';
import { salesOverviewBuckets } from './salesOverview';
import './merchant-overview.css';
import './merchant-points.css';

type Insights = { balance: number; carriedForward: number | null; events: { timestamp: string; issued: number; redeemed: number }[] };
const number = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export function MerchantPoints({ user }: { user: UserProfile }) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'date'>('month');
  const [date, setDate] = useState(() => indiaDate(new Date()));
  const range = (period === 'date' ? rangeForChartPeriod('custom', date, date) : rangeForChartPeriod(period))!;
  const query = useQuery({ queryKey: ['merchant-point-insights', user.merchant_id, range.from, range.to], queryFn: ({ signal }) => apiFetch<Insights>(`/api/merchants/${user.merchant_id}/point-insights?${new URLSearchParams(range)}`, { signal }), refetchInterval: 30000 });
  const data = query.data;
  const chartPeriod = period === 'date' ? "today" : period;
  const issued = salesOverviewBuckets((data?.events || []).map(e => ({ timestamp: e.timestamp, amount: Number(e.issued) })), chartPeriod, range);
  const redeemed = salesOverviewBuckets((data?.events || []).map(e => ({ timestamp: e.timestamp, amount: Number(e.redeemed) })), chartPeriod, range);
  const max = Math.max(1, ...issued.map(b => b.sales), ...redeemed.map(b => b.sales));
  return <main className="merchant-overview merchant-points"><Link to="/dashboard" className="button secondary"><ArrowLeft size={16}/>{uiText(" Back to dashboard")}</Link><h1>{uiText("AE Points")}</h1>
    {query.isPending ? <LoadingState/> : query.isError ? <ErrorState error={query.error} retry={() => query.refetch()}/> : data && <>
      <section className="mo-points-balance"><Coins size={40}/><div><span>{uiText("Available AE Points")}</span><strong>{number(data.balance)}</strong><p>{uiText("Current balance available to issue to customers")}</p></div></section>
      <div className="mo-columns" style={{ margin: '20px 0', flexWrap: 'wrap' }}>
        <section className="mo-panel"><h2>{uiText("Carried forwarded from Last Month")}</h2><h1 aria-label={data.carriedForward === null ? uiText('Not recorded') : undefined}>{data.carriedForward === null ? '—' : number(data.carriedForward)}</h1></section>
        <section className="mo-panel"><h2>{uiText("Points issued by You")}</h2><h1>{number(issued.reduce((s,b) => s+b.sales,0))}</h1></section>
        <section className="mo-panel"><h2>{uiText("Points redeemed by Customers")}</h2><h1>{number(redeemed.reduce((s,b) => s+b.sales,0))}</h1></section>
      </div>
    </>}
    <section className="mo-panel"><div className="mo-panel-heading"><div><h2>{uiText("Points issued vs redeemed")}</h2><p>{uiText("AE Points · ")}{period === 'date' ? date : period === 'today' ? uiText("Today") : period === 'week' ? uiText("This week") : uiText("This month")}</p></div><div><select aria-label={uiText("Points graph period")} value={period} onChange={e => setPeriod(e.target.value as typeof period)}><option value="today">{uiText("Today")}</option><option value="week">{uiText("This Week")}</option><option value="month">{uiText("This Month")}</option><option value="date">{uiText("Choose Date")}</option></select>{period === 'date' && <input type="date" aria-label={uiText("Points graph date")} max={indiaDate(new Date())} value={date} onChange={e => { if(e.target.value) setDate(e.target.value); }}/>}</div></div>
      {data && !query.isError && <><div className="mo-chart-values"><span><i style={{ background: '#1875eb' }}/>{uiText("Issued")}</span><span><i style={{ background: '#8055d5' }}/>{uiText("Redeemed")}</span></div><div className="mo-bars">{issued.map((b,i) => <div className="mo-bar-item" key={b.label}><strong style={{ fontSize: 12 }}>{number(b.sales)} / {number(redeemed[i].sales)}</strong><div style={{ display: 'flex', alignItems: 'end', gap: 6, height: 140 }}><span style={{ background: '#1875eb', width: 20, height: b.sales / max * 130 }}/><span style={{ background: '#8055d5', width: 20, height: redeemed[i].sales / max * 130 }}/></div><small>{uiText(b.label)}</small></div>)}</div></>}
    </section>
  </main>;
}
