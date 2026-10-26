import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import { FieldMerchantMapper, type MapMerchant } from './FieldMerchantMapper';
import { FieldRouteMap } from './FieldRouteMap';

type Category = { id: string; name: string };
export function OnboardedMerchantsMap({ managerId, viewerId, allMerchants, categories = [] }: {
  managerId?: string; viewerId: string; allMerchants?: MapMerchant[]; categories?: Category[];
}) {
  const [scope, setScope] = useState<'own' | 'all'>('own');
  const [view, setView] = useState<'shops' | 'route'>('shops');
  const q = useQuery({
    queryKey: ['field-onboarded-merchants', viewerId, managerId || 'self'],
    queryFn: ({ signal }) => apiFetch<{ merchants: MapMerchant[]; missingLocations: number }>(managerId
      ? `/api/admin/field-managers/${encodeURIComponent(managerId)}/onboarded-merchants`
      : '/api/field/onboarded-merchants', { signal }),
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
  const shops = scope === 'all' ? allMerchants || [] : q.data?.merchants || [];
  const inferredCategories = [...new Map(shops.filter(shop => shop.category_id && shop.merchant_categories?.name)
    .map(shop => [shop.category_id!, { id: shop.category_id!, name: shop.merchant_categories!.name! }])).values()];
  return <section className="panel onboarded-map-section">
    <div className="panel-heading"><h2>{uiText(managerId ? 'Onboarded shops' : 'Merchant Mapper')}</h2>
      <button className="button secondary" type="button" onClick={() => void q.refetch()} disabled={q.isFetching}>{uiText('Refresh')}</button></div>
    {allMerchants && <div className="fm-scope-switch" role="group" aria-label={uiText('Shop map filter')}>
      <button type="button" className={`button ${scope === 'own' ? 'primary' : 'secondary'}`} aria-pressed={scope === 'own'} onClick={() => setScope('own')}>{uiText('My onboarded shops')}</button>
      <button type="button" className={`button ${scope === 'all' ? 'primary' : 'secondary'}`} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>{uiText('All shops')}</button>
    </div>}
    <div className="fm-scope-switch" role="group" aria-label={uiText('Map view')}>
      <button type="button" className={`button ${view === 'shops' ? 'primary' : 'secondary'}`} aria-pressed={view === 'shops'} onClick={() => setView('shops')}>{uiText('Shop pins')}</button>
      <button type="button" className={`button ${view === 'route' ? 'primary' : 'secondary'}`} aria-pressed={view === 'route'} onClick={() => setView('route')}>{uiText('Plan shop route')}</button>
    </div>
    {scope === 'own' && q.isPending ? <p role="status">{uiText('Loading onboarded shops…')}</p>
      : scope === 'own' && q.isError ? <p role="alert">{uiText('Onboarded shop locations are unavailable. Please retry.')}</p>
      : <><p>{uiText(scope === 'all' ? 'Pins use saved shop locations.' : 'All shops onboarded by this Field Manager, shown at their saved shop locations.')}</p>
        {scope === 'own' && !shops.length && <p>{uiText('No onboarded shops have been recorded for this Field Manager yet.')}</p>}
        {view === 'shops' ? <FieldMerchantMapper merchants={shops} categories={categories.length ? categories : inferredCategories} embedded />
          : <><p>{uiText('Choose shops in the order you plan to visit, then build the road route.')}</p><FieldRouteMap key={`${managerId || viewerId}-${scope}`} merchants={shops} /></>}
      </>}
  </section>;
}
