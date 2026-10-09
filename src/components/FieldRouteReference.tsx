import { uiText } from '../uiText';
import { ROUTE_REFERENCE } from '../merchantRoutes';
import './field-route-reference.css';

export function FieldRouteReference() {
  return <details className="ae-route-reference" open><summary>{uiText("Weekly route reference")}</summary><p>{uiText("Coverage guide only. Merchant counts below are planned targets, not completed visits.")}</p><div className="ae-route-reference-list">{ROUTE_REFERENCE.map(item => <article key={item.route}><header><strong>{item.route}</strong><span>{item.day}</span></header><dl><div><dt>{uiText("From")}</dt><dd>{item.from}</dd></div><div><dt>{uiText("Coverage")}</dt><dd>{item.via || 'Not specified'}</dd></div><div><dt>{uiText("To")}</dt><dd>{item.to}</dd></div></dl><small>{uiText("Planned: 25–30 stores")}</small>{item.remarks && <p>{item.remarks}</p>}</article>)}</div><footer><p><strong>{uiText("Sunday:")}</strong>{uiText(" Weekly off · On-call support")}</p><p><strong>{uiText("Weekly target:")}</strong>{uiText(" 150–180 stores")}</p><p><strong>{uiText("Visiting hours:")}</strong>{uiText(" 10:00 AM–6:30 PM")}</p><p>{uiText("Daily meeting after working hours to discuss progress.")}</p><p><strong>{uiText("Future routes — TBD:")}</strong>{uiText(" Vandithalavam, Nallepily, Kozhijam Para, 5th Mile")}</p></footer></details>;
}
