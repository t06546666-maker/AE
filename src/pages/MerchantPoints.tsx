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
  const chartPeriod = period === 'date' ? 'today' : period;
  const issued = salesOverviewBuckets((data?.events || []).map(e => ({ timestamp: e.timestamp, amount: Number(e.issued) })), chartPeriod, range);
  const redeemed = salesOverviewBuckets((data?.events || []).map(e => ({ timestamp: e.timestamp, amount: Number(e.redeemed) })), chartPeriod, range);
  const max = Math.max(1, ...issued.map(b => b.sales), ...redeemed.map(b => b.sales));
  return <main className="merchant-overview merchant-points"><Link to="/dashboard" className="button secondary"><ArrowLeft size={16}/> Back to dashboard</Link><h1>AE Points</h1>
    {query.isPending ? <LoadingState/> : query.isError ? <ErrorState error={query.error} retry={() => query.refetch()}/> : data && <>
      <section className="mo-points-balance"><Coins size={40}/><div><span>Available AE Points</span><strong>{number(data.balance)}</strong><p>Current balance available to issue to customers</p></div></section>
      <div className="mo-columns" style={{ margin: '20px 0', flexWrap: 'wrap' }}>
        <section className="mo-panel"><h2>Carried forward</h2><h1>{data.carriedForward === null ? 'Not recorded' : number(data.carriedForward)}</h1><p>Remaining balance from the previous month</p>{data.carriedForward === null && <small>Historical balance was not captured. Future monthly balances will be recorded automatically.</small>}</section>
        <section className="mo-panel"><h2>Points issued</h2><h1>{number(issued.reduce((s,b) => s+b.sales,0))}</h1><p>Selected graph period · purchases and loyalty rewards</p></section>
        <section className="mo-panel"><h2>Points redeemed</h2><h1>{number(redeemed.reduce((s,b) => s+b.sales,0))}</h1><p>Selected graph period · redeemed at your shop</p></section>
      </div>
    </>}
    <section className="mo-panel"><div className="mo-panel-heading"><div><h2>Points issued vs redeemed</h2><p>AE Points · {period === 'date' ? date : period === 'today' ? 'Today' : period === 'week' ? 'This week' : 'This month'}</p></div><div><select aria-label="Points graph period" value={period} onChange={e => setPeriod(e.target.value as typeof period)}><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="date">Choose Date</option></select>{period === 'date' && <input type="date" aria-label="Points graph date" max={indiaDate(new Date())} value={date} onChange={e => { if(e.target.value) setDate(e.target.value); }}/>}</div></div>
      {data && !query.isError && <><div className="mo-chart-values"><span><i style={{ background: '#1875eb' }}/>Issued</span><span><i style={{ background: '#8055d5' }}/>Redeemed</span></div><div className="mo-bars">{issued.map((b,i) => <div className="mo-bar-item" key={b.label}><strong style={{ fontSize: 12 }}>{number(b.sales)} / {number(redeemed[i].sales)}</strong><div style={{ display: 'flex', alignItems: 'end', gap: 6, height: 140 }}><span style={{ background: '#1875eb', width: 20, height: b.sales / max * 130 }}/><span style={{ background: '#8055d5', width: 20, height: redeemed[i].sales / max * 130 }}/></div><small>{b.label}</small></div>)}</div><p>Values above each pair: issued / redeemed. Redemption does not replenish your available allocation.</p>{!data.events.length && <p>No point activity recorded for this period.</p>}</>}
    </section>
  </main>;
}
