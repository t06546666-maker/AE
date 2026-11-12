import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { uiText } from '../uiText';

type Content = { version: number; updatedAt: string; sections: unknown[]; banners: Array<Record<string, unknown>>; pageText: Record<string, unknown> };

export function AdminCustomerUi() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin-customer-home-content'], queryFn: () => apiFetch<{ content: Content }>('/api/admin/customer-home-content') });
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const save = useMutation({
    mutationFn: (content: Content) => apiFetch('/api/admin/customer-home-content', { method: 'PUT', body: JSON.stringify(content) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['admin-customer-home-content'] }),
  });
  const content = query.data?.content;
  const initial = { greeting: 'Welcome to AE', subtitle: 'Where customers meet businesses and beyond', trendingTitle: 'Trending Offers', nearbyTitle: 'Nearby Best Offers', exploreLabel: 'Explore', pointsLabel: 'Claim Points', ordersLabel: 'Orders', offersLabel: 'Offers', reportsLabel: 'Reports', moreLabel: 'More', ...(content?.pageText || {}) } as Record<string, string>;
  const fields: Array<[string, string]> = [['greeting', 'Home greeting'], ['subtitle', 'Home subtitle'], ['trendingTitle', 'Trending offers heading'], ['nearbyTitle', 'Nearby offers heading'], ['exploreLabel', 'Explore button'], ['pointsLabel', 'Claim points button'], ['ordersLabel', 'Orders navigation'], ['offersLabel', 'Offers navigation'], ['reportsLabel', 'Reports navigation'], ['moreLabel', 'More navigation']];
  const values = draft || initial;
  const update = (key: string, value: string) => setDraft({ ...values, [key]: value });
  return <main className="dashboard-page">
    <div className="page-heading"><div><h1>{uiText('Customer UI Editor')}</h1><p>{uiText('Edit customer-facing text and content settings. Banner images remain in Ad Banners.')}</p></div></div>
    <section className="panel">
      {query.isPending ? <p>{uiText('Loading…')}</p> : query.isError ? <p role="alert">{uiText('Customer UI settings are unavailable.')}</p> : <>
        <div className="admin-ui-editor-grid"><div><h2>{uiText('Customer home content')}</h2><p className="admin-data-note">{uiText('Edit the visible labels and headings without touching code.')}</p>{fields.map(([key, label]) => <label key={key}>{uiText(label)}<input value={values[key] || ''} onChange={event => update(key, event.target.value)} /></label>)}<p className="admin-data-note">{uiText('Upload and reorder banner images from Ad Banners.')}</p></div><div className="admin-ui-live-preview"><h2>{uiText('Live preview')}</h2><div className="customer-ui-phone"><div className="customer-ui-phone-head"><b>AE</b><span>📍 Select location</span><i>♧</i><i>🔔</i></div><strong>{values.greeting} 👋</strong><small>{values.subtitle}</small><div className="customer-ui-carousel"><div className="customer-ui-banner">{values.trendingTitle}<small>Every day offers and local rewards</small></div><div className="customer-ui-dots">● ● ● ● ● ●</div></div><div className="customer-ui-points"><b>⭐ AVAILABLE POINTS: 119 PTS</b><div><button>{values.pointsLabel}<small>Scan QR Code</small></button><button>Redeem Points<small>Scan QR Code</small></button></div></div><div className="customer-ui-section"><b>{values.nearbyTitle}</b><span>{values.exploreLabel} →</span></div><div className="customer-ui-offers"><article>OFFER<br/><b>Local favourite</b></article><article>OFFER<br/><b>Fresh deals</b></article></div><footer>{values.ordersLabel} · {values.offersLabel} · {values.reportsLabel} · {values.moreLabel}</footer></div></div></div>
        {save.isError && <p role="alert" className="form-error">{save.error.message}</p>}
        <button type="button" className="button primary" disabled={save.isPending || !content} onClick={() => save.mutate({ ...content!, pageText: values })}>{save.isPending ? uiText('Saving…') : uiText('Save customer UI')}</button>
      </>}
    </section>
  </main>;
}
