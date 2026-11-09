import { uiText } from '../uiText';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Store, ChevronRight, Check } from 'lucide-react';
import { apiFetch } from '../api';
import { MERCHANT_ROUTES } from '../merchantRoutes';
import { useToast } from '../toast';
import './field-route-planning.css';
import { FieldRouteMap } from './FieldRouteMap';
import { FieldRouteReference } from './FieldRouteReference';

type RouteMerchant = { id: string; name: string; merchant_code: string; address?: string; route_name?: string; latitude?: number; longitude?: number };
type RoutePlan = { route_name: string; work_date: string };
export function FieldRoutePlanning({ merchants }: { merchants: RouteMerchant[] }) {
  const client = useQueryClient(); const { showToast } = useToast();
  const [candidate, setCandidate] = useState<string | null>(null); const [showMerchants, setShowMerchants] = useState(false);
  const query = useQuery({ queryKey: ['field-route-plan'], queryFn: () => apiFetch<{ plan: RoutePlan | null; workDate: string }>('/api/field/route-plan'), refetchInterval: 60000 });
  const selected = query.data?.plan?.route_name;
  const selectedMerchants = merchants.filter(merchant => merchant.route_name === selected && selected);
  const save = useMutation({ mutationFn: (route: string) => apiFetch('/api/field/route-plan', { method: 'PUT', body: JSON.stringify({ route_name: route }) }), onSuccess: () => { setCandidate(null); setShowMerchants(false); void client.invalidateQueries({ queryKey: ['field-route-plan'] }); showToast('Today’s route selected.'); }, onError: error => showToast(error.message, 'error') });
  const mapUrl = (merchant: RouteMerchant) => {
    const location = merchant.latitude != null && merchant.longitude != null ? `${merchant.latitude},${merchant.longitude}` : merchant.address;
    return location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : null;
  };
  return <section className="field-route-planning">
    <FieldRouteReference />
    <header><MapPin /><div><h1>{showMerchants ? uiText("Merchants on your route") : uiText("Route Selection")}</h1><p>{uiText("Plan your merchant visits for today.")}</p></div></header>
    {query.isPending ? <p>{uiText("Loading today’s route…")}</p> : query.isError ? <div role="alert"><p>{query.error.message}</p><button className="button secondary" onClick={() => void query.refetch()}>{uiText("Retry")}</button></div> : <>
      <article className="route-summary"><div><small>{uiText("Today’s route")}</small><strong>{selected || 'Not selected'}</strong><span>{query.data?.workDate}</span></div><div><Store /><strong>{selected ? selectedMerchants.length : '—'}</strong><small>{uiText("Merchants")}</small></div></article>
      {!showMerchants ? <><div className="route-options">{MERCHANT_ROUTES.map(route => {
        const count = merchants.filter(merchant => merchant.route_name === route).length;
        return <button key={route} className={selected === route ? 'selected' : ''} disabled={save.isPending} onClick={() => { if (selected !== route) setCandidate(route); }}><div><strong>{route}</strong><small>{count}{uiText(" merchants")}</small></div>{selected === route ? <Check /> : <ChevronRight />}</button>;
      })}</div><button className="button primary route-continue" disabled={!selected || save.isPending} onClick={() => setShowMerchants(true)}>{uiText("Continue ")}<ChevronRight size={18} /></button></> : <>
        <button className="button secondary" onClick={() => setShowMerchants(false)}>{uiText("Change route")}</button>
        <FieldRouteMap key={selected} merchants={selectedMerchants} />
        {!selectedMerchants.length && <p>{uiText("No merchants are assigned to this route yet. Select their route during onboarding.")}</p>}
        <div className="route-merchants">{selectedMerchants.map(merchant => <article key={merchant.id}><Store /><div><strong>{merchant.name}</strong><small>{merchant.merchant_code}</small><p>{merchant.address || 'Address not added'}</p><div className="route-merchant-actions"><Link className="button primary" to={`/field/merchants/${encodeURIComponent(merchant.id)}`}>{uiText("View merchant")}</Link>{mapUrl(merchant) && <a className="button secondary" target="_blank" rel="noopener noreferrer" href={mapUrl(merchant)!}>{uiText("View map")}</a>}</div></div></article>)}</div>
      </>}
    </>}
    {candidate && <div className="modal-backdrop"><div className="modal"><h2>{selected ? uiText("Change route?") : uiText("Select route?")}</h2><p>{selected ? `Change today’s route from ${selected} to ${candidate}?` : `Use ${candidate} for today’s visits?`}</p><div className="route-merchant-actions"><button className="button secondary" disabled={save.isPending} onClick={() => setCandidate(null)}>{uiText("Cancel")}</button><button className="button primary" disabled={save.isPending} onClick={() => save.mutate(candidate)}>{save.isPending ? uiText("Saving…") : uiText("Confirm")}</button></div></div></div>}
  </section>;
}
