import { useQuery } from '@tanstack/react-query';
import { apiFetch, queryString } from '../api';
import { GraphPeriod, useGraphPeriod } from './GraphPeriod';
import { uiText } from '../uiText';
import { ErrorState, LoadingState } from './Common';

type Performance = { trackingAvailable: boolean; offers: { id: string; title: string; purchases: number | null }[] };
export function OfferPerformance({ merchantId }: { merchantId: string | null }) {
  const period = useGraphPeriod();
  const data = useQuery({ queryKey: ['offer-performance', merchantId, period.range?.from, period.range?.to], queryFn: ({ signal }) => apiFetch<Performance>(`/api/offers-performance?${queryString(period.range || {})}`, { signal }), enabled: !!merchantId });
  const maximum = Math.max(1, ...(data.data?.offers.map(offer => offer.purchases || 0) || []));
  return <section className="panel" style={{ marginBottom: 24 }} aria-labelledby="offer-performance-title">
    <div className="panel-heading"><h2 id="offer-performance-title">{uiText('Offer performance')}</h2><GraphPeriod state={period} label="Offer performance period" /></div>
    <p>{uiText('Purchases linked to each offer')}</p>
    {data.isPending ? <LoadingState /> : data.isError ? <ErrorState error={data.error} retry={() => void data.refetch()} /> : <>
      {!data.data.offers.length && <p>{uiText('Create an offer to see it here.')}</p>}
      <div style={{ display: 'grid', gap: 20, margin: '24px 0' }}>{data.data.offers.map(offer => <div key={offer.id}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}><span style={{ overflowWrap: 'anywhere' }}>{offer.title}</span><span style={{ whiteSpace: 'nowrap' }}>{offer.purchases === null ? uiText('Not tracked') : `${offer.purchases} ${uiText('purchases')}`}</span></div><div aria-label={offer.title} style={{ height: 12, borderRadius: 8, background: 'var(--border, #e3eaf5)', overflow: 'hidden' }}><div style={{ width: `${100 * (offer.purchases || 0) / maximum}%`, height: '100%', borderRadius: 8, background: '#1769f5' }} /></div></div>)}</div>
      {!data.data.trackingAvailable && <p>{uiText('Purchase-to-offer tracking is not available yet. Counts will appear once purchases are linked to offers.')}</p>}
    </>}
  </section>;
}
