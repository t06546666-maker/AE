import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import { HomeBanners } from '../components/HomeBanners';

type Content = { version: number; updatedAt: string; sections: unknown[]; banners: Array<Record<string, unknown>>; pageText: Record<string, unknown> };

export function AdminCustomerUi() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin-customer-home-content'], queryFn: () => apiFetch<{ content: Content }>('/api/admin/customer-home-content') });
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [selected, setSelected] = useState('greeting');
  const [device, setDevice] = useState(360);
  const select = (key: string) => { setSelected(key); document.getElementById('edit-' + key)?.focus({preventScroll:true}); document.getElementById('edit-' + key)?.scrollIntoView({block:'nearest',behavior:'smooth'}); };
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
        <div className="admin-ui-editor-grid">
          <div style={{maxHeight:'calc(100dvh - 220px)',overflowY:'auto',paddingRight:12}}><h2>Click the preview to edit</h2><p>Selected: {fields.find(([key])=>key===selected)?.[1]}</p>
          {fields.map(([key,label])=><label key={key} style={{background:selected===key?'#edf4ff':undefined,padding:8,borderRadius:10}}>{label}<input id={'edit-'+key} value={values[key]||''} onFocus={()=>setSelected(key)} onChange={e=>update(key,e.target.value)}/></label>)}
          <a href="/admin/banners">Edit banner images and carousel →</a></div>
          <div className="admin-ui-live-preview" style={{alignSelf:'start',position:'sticky',top:90,height:'calc(100dvh - 220px)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <h2>Customer preview</h2><select aria-label="Preview device" value={device} onChange={e=>setDevice(Number(e.target.value))}><option value={360}>Phone</option><option value={768}>Tablet</option><option value={1100}>Laptop</option></select>
          <p>Click any outlined text to edit it. Banner uses your actual uploaded images.</p>
          <div tabIndex={0} aria-label="Scroll full customer preview" style={{overflow:'auto',maxWidth:'100%',minHeight:0,flex:1,overscrollBehavior:'contain'}}><div className="customer-ui-phone" style={{width:device,maxWidth:'none',boxSizing:'border-box',margin:'12px auto',minHeight:600}}>
          <div className="customer-ui-phone-head"><img src="/logo.png" alt="AE" width="52"/><span>📍 Select location</span><span>♙ 🔔</span></div>
          <button className="ui-edit-target" onClick={()=>select('greeting')}>{values.greeting} 👋</button>
          <button className="ui-edit-target" onClick={()=>select('subtitle')}>{values.subtitle}</button>
          <HomeBanners/>
          <div className="customer-ui-points"><b>⭐ AVAILABLE POINTS — preview</b><div><button onClick={()=>select('pointsLabel')}>{values.pointsLabel}<small>Scan QR Code</small></button><button>Redeem Points<small>Scan QR Code</small></button></div></div>
          <div className="customer-ui-section"><button className="ui-edit-target" onClick={()=>select('nearbyTitle')}>{values.nearbyTitle}</button><button className="ui-edit-target" onClick={()=>select('exploreLabel')}>{values.exploreLabel} →</button></div>
          <p>Offer artwork is managed in Offers and Ad Banners.</p>
          <button className="ui-edit-target" onClick={()=>select('trendingTitle')}>{values.trendingTitle}</button>
          <footer>{['ordersLabel','offersLabel','reportsLabel','moreLabel'].map(key=><button key={key} className="ui-edit-target" onClick={()=>select(key)}>{values[key]}</button>)}</footer>
          </div></div></div></div>
        {save.isError && <p role="alert" className="form-error">{save.error.message}</p>}
        <button type="button" className="button primary" disabled={save.isPending || !content} onClick={() => save.mutate({ ...content!, pageText: values })}>{save.isPending ? uiText('Saving…') : uiText('Save customer UI')}</button>
      </>}
    </section>
  </main>;
}
