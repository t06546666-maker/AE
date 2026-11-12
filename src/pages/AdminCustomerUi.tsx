import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import { CustomerHome } from './customer/Home';

type Content = { version: number; updatedAt: string; sections: unknown[]; banners: Array<Record<string, unknown>>; pageText: Record<string, unknown> };

export function AdminCustomerUi() {
  if(new URLSearchParams(window.location.search).get('canvas')==='1') return <><style>{`.topbar,.sidebar,.mobile-topbar{display:none!important}.main-content{padding:0!important;max-width:none!important}.app-shell,.shell-body{display:block!important}`}</style><div className="customer-glass"><CustomerHome preview user={{id:'admin-preview',name:'Customer',full_name:'Preview',email:'',role:'customer',merchant_id:null}}/></div></>;
  return <CustomerUiEditor/>;
}
function CustomerUiEditor() {
  useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.data?.type!=='ae-preview-select')return;const key=event.data.key;if(typeof key==='string'){setSelected(key);document.getElementById('edit-'+key)?.focus({preventScroll:true});}};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[]);
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
          <div className="admin-ui-live-preview" style={{alignSelf:'start',position:'sticky',top:90,maxHeight:'none',overflow:'visible',minWidth:0}}>
          <h2>Customer preview</h2><select aria-label="Preview device" value={device} onChange={e=>setDevice(Number(e.target.value))}><option value={360}>Phone</option><option value={768}>Tablet</option><option value={1100}>Laptop</option></select>
          <p>Click any outlined text to edit it. Banner uses your actual uploaded images.</p>
          <div style={{overflow:'auto',height:'calc(100dvh - 310px)',minHeight:350}}><iframe title="Actual customer home preview" src="/admin/customer-ui?canvas=1" style={{width:device,height:'100%',minHeight:350,border:'1px solid #ccd8e8',background:'white'}}/></div></div></div>
        {save.isError && <p role="alert" className="form-error">{save.error.message}</p>}
        <button type="button" className="button primary" disabled={save.isPending || !content} onClick={() => save.mutate({ ...content!, pageText: values })}>{save.isPending ? uiText('Saving…') : uiText('Save customer UI')}</button>
      </>}
    </section>
  </main>;
}
