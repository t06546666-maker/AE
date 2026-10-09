import type { MerchantAnalytics } from '../pages/merchantAnalytics';
import { uiText } from '../uiText';
import { GraphPeriod, useGraphPeriod } from './GraphPeriod';

export function CustomerFrequency({ model }: { model: MerchantAnalytics }) {
  const period = useGraphPeriod();
  const counts = new Map<string, number>();
  const from = Date.parse(period.range!.from), to = Date.parse(period.range!.to);
  for (const order of model.customers.flatMap(customer => customer.visits)) {
    const time = Date.parse(order.timestamp);
    if (time < from || time >= to || !Number.isFinite(time)) continue;
    const customer = order.cid || order.phone || order.id;
    counts.set(customer, (counts.get(customer) || 0) + 1);
  }
  const frequency = [...counts.values()];
  const rows = [
    { label: 'One purchase', value: frequency.filter(count => count === 1).length },
    { label: '2-3 purchases', value: frequency.filter(count => count >= 2 && count <= 3).length },
    { label: '4+ purchases', value: frequency.filter(count => count >= 4).length },
  ];
  const total = frequency.length;
  return <section className="mo-panel" aria-labelledby="customer-frequency-title">
    <div className="mo-panel-heading"><div><h2 id="customer-frequency-title">{uiText('Customer visit frequency')}</h2><p>{uiText('How often customers shop in the selected period')}</p></div><GraphPeriod state={period} label="Customer frequency period" /></div>
    {rows.map(row => <div className="mo-spend-row" key={row.label}><div><span>{uiText(row.label)}</span><strong>{row.value} {uiText('customers')}</strong></div><div className="mo-progress"><span style={{ width: `${total ? row.value / total * 100 : 0}%`, background: '#1875eb' }} /></div></div>)}
    <p className="mo-note">{uiText('A quick view of occasional and regular customers. Each recorded purchase counts as a visit.')}</p>
    {!total && <p className="mo-empty">{uiText('No purchases recorded in this period.')}</p>}
  </section>;
}
