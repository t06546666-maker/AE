import { GraphPeriod, useGraphPeriod } from './GraphPeriod';
import { uiText } from '../uiText';

const referenceOffers = [{ id:'weekend',title:'Weekend offer',purchases:48 },{ id:'first',title:'First-purchase offer',purchases:32 },{ id:'loyal',title:'Loyal-customer offer',purchases:21 }];
export function OfferPerformance(_: { merchantId: string | null }) {
  const period = useGraphPeriod();
  const data = { data: { offers:referenceOffers, trackingAvailable:false }, isPending:false, isError:false };
  const maximum = 50;
  return <section className="panel" style={{ marginBottom: 24 }} aria-labelledby="offer-performance-title">
    <div className="panel-heading"><h2 id="offer-performance-title">{uiText('Offer performance')}</h2><GraphPeriod state={period} label="Offer performance period" /></div>
    <p>{uiText('Purchases linked to each offer')}</p>
    <span className="tag blue">{uiText('Demo preview')}</span>
    <>
      <div style={{ display: 'grid', gap: 20, margin: '24px 0' }}>{data.data.offers.map(offer => <div key={offer.id}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}><span style={{ overflowWrap: 'anywhere' }}>{offer.title}</span><span style={{ whiteSpace: 'nowrap' }}>{offer.purchases === null ? uiText('Not tracked') : `${offer.purchases} ${uiText('purchases')}`}</span></div><div aria-label={offer.title} style={{ height: 12, borderRadius: 8, background: 'var(--border, #e3eaf5)', overflow: 'hidden' }}><div style={{ width: `${100 * (offer.purchases || 0) / maximum}%`, height: '100%', borderRadius: 8, background: '#1769f5' }} /></div></div>)}</div>
      <p>{uiText('Sample data for reference only. Date selection does not change these example values.')}</p>
    </>
  </section>;
}
