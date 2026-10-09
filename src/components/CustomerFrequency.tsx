import type { MerchantAnalytics } from '../pages/merchantAnalytics';
import { uiText } from '../uiText';

export function CustomerFrequency({ model }: { model: MerchantAnalytics }) {
  const counts = new Map<string, number>();
  for (const order of model.current.orders) {
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
    <div className="mo-panel-heading"><div><h2 id="customer-frequency-title">{uiText('Customer visit frequency')}</h2><p>{uiText('How often customers shop in the selected month')}</p></div></div>
    {rows.map(row => <div className="mo-spend-row" key={row.label}><div><span>{uiText(row.label)}</span><strong>{row.value} {uiText('customers')}</strong></div><div className="mo-progress"><span style={{ width: `${total ? row.value / total * 100 : 0}%`, background: '#1875eb' }} /></div></div>)}
    <p className="mo-note">{uiText('A quick view of occasional and regular customers. Each recorded purchase counts as a visit.')}</p>
    {!total && <p className="mo-empty">{uiText('No purchases recorded in this month.')}</p>}
  </section>;
}
