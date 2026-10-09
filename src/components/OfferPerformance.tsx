import { GraphPeriod, useGraphPeriod } from './GraphPeriod';
import { uiText } from '../uiText';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, queryString } from '../api';
import { LoadingState, ErrorState } from './Common';

type Performance = { offers:{id:string;title:string;purchases:number|null;startUnknown?:boolean}[] };
export function OfferPerformance({merchantId}: { merchantId: string | null }) {
  const savedMonth = localStorage.getItem(`ae-reporting-month:${merchantId}`) || undefined;
  const period = useGraphPeriod(savedMonth);
  const data = useQuery({ queryKey:['offer-performance',merchantId,period.range?.from,period.range?.to], queryFn:({signal})=>apiFetch<Performance>(`/api/offers-performance?${queryString(period.range || {})}`,{signal}), enabled:!!merchantId && !!period.range,refetchInterval:30000 });
  const maximum = Math.max(1,...(data.data?.offers.map(offer=>offer.purchases || 0) || []));
  return <section className="panel" style={{ marginBottom: 24 }} aria-labelledby="offer-performance-title">
    <div className="panel-heading"><h2 id="offer-performance-title">{uiText('Offer performance')}</h2><GraphPeriod state={period} label="Offer performance period" /></div>
    <p>{uiText('Purchases during approved offer dates')}</p>
    {data.isPending ? <LoadingState /> : data.isError ? <ErrorState error={data.error} retry={()=>void data.refetch()} /> : data.data && <>
      <div style={{ display: 'grid', gap: 20, margin: '24px 0' }}>{data.data.offers.map(offer => <div key={offer.id}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}><span style={{ overflowWrap: 'anywhere' }}>{offer.title}</span><span style={{ whiteSpace: 'nowrap' }}>{offer.purchases === null ? uiText('Start date unavailable') : `${offer.purchases} ${uiText('purchases')}`}</span></div><div aria-label={offer.title} style={{ height: 12, borderRadius: 8, background: 'var(--border, #e3eaf5)', overflow: 'hidden' }}><div style={{ width: `${100 * (offer.purchases || 0) / maximum}%`, height: '100%', borderRadius: 8, background: '#1769f5' }} /></div></div>)}</div>
      {!data.data.offers.length && <p>{uiText('No approved offers yet.')}</p>}
      <p>{uiText('All shop purchases during the offer period, not confirmed offer usage. Overlapping offers may include the same purchases.')}</p>
    </>}
  </section>;
}
