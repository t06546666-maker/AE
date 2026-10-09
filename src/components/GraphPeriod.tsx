import { useState } from 'react';
import { indiaDate } from '../pages/merchantAnalytics';
import { rangeForChartPeriod } from '../utils';
import { uiText } from '../uiText';
export function useGraphPeriod(reportingMonth?: string) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'date'>('month');
  const [date, setDate] = useState(indiaDate(new Date()));
  const range = period === 'date' ? rangeForChartPeriod('custom', date, date) : rangeForChartPeriod(period, undefined, undefined, reportingMonth);
  return { period, setPeriod, date, setDate, range };
}
export function GraphPeriod({ state, label }: { state: ReturnType<typeof useGraphPeriod>; label: string }) {
  return <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}><select aria-label={uiText(label)} value={state.period} onChange={event => state.setPeriod(event.target.value as typeof state.period)}>{[['today','Today'],['week','This Week'],['month','This Month'],['date','Choose Date']].map(([value,text]) => <option key={value} value={value}>{uiText(text)}</option>)}</select>{state.period === 'date' && <input aria-label={uiText('Choose Date')} type="date" value={state.date} max={indiaDate(new Date())} onChange={event => { if(event.target.value) state.setDate(event.target.value); }} />}</div>;
}
