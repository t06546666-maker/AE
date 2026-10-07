import { ROUTE_REFERENCE } from '../merchantRoutes';
import './field-route-reference.css';

export function FieldRouteReference() {
  return <details className="ae-route-reference" open><summary>Weekly route reference</summary><p>Coverage guide only. Merchant counts below are planned targets, not completed visits.</p><div className="ae-route-reference-list">{ROUTE_REFERENCE.map(item => <article key={item.route}><header><strong>{item.route}</strong><span>{item.day}</span></header><dl><div><dt>From</dt><dd>{item.from}</dd></div><div><dt>Coverage</dt><dd>{item.via || 'Not specified'}</dd></div><div><dt>To</dt><dd>{item.to}</dd></div></dl><small>Planned: 25–30 stores</small>{item.remarks && <p>{item.remarks}</p>}</article>)}</div><footer><p><strong>Sunday:</strong> Weekly off · On-call support</p><p><strong>Weekly target:</strong> 150–180 stores</p><p><strong>Visiting hours:</strong> 10:00 AM–6:30 PM</p><p>Daily meeting after working hours to discuss progress.</p><p><strong>Future routes — TBD:</strong> Vandithalavam, Nallepily, Kozhijam Para, 5th Mile</p></footer></details>;
}
