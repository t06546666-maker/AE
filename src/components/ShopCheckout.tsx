import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import type { RewardSettings } from '../types';
import QrScanner from './QrScanner';

type Request = {id:string;customerCode:string;merchantName:string;action:'earn'|'combined';status:string;expiresAt:number};
export function MerchantShopCheckout() {
  const [params]=useSearchParams();const id=params.get('request');const [qr,setQr]=useState('');
  const requests=useQuery({queryKey:['shop-requests'],queryFn:()=>apiFetch<{requests:Request[]}>('/api/merchant/shop-requests'),refetchInterval:5000});
  const settings=useQuery({queryKey:['reward-settings'],queryFn:()=>apiFetch<RewardSettings>('/api/settings/reward')});
  const token=useQuery({queryKey:['shop-qr'],queryFn:()=>apiFetch<{payload:string}>('/api/merchant/shop-qr')});
  useEffect(()=>{let active=true;if(token.data)void QRCode.toDataURL(token.data.payload,{width:600,margin:3}).then(value=>{if(active)setQr(value);});return()=>{active=false;};},[token.data]);
  const selected=requests.data?.requests.find(row=>row.id===id);
  return <section className="panel"><h1>{uiText('Shop QR checkout')}</h1><p>{uiText('Customers scan this shop QR and request Earn or Redeem + Earn. Confirm the actual bill before awarding points.')}</p>
    {(requests.error||token.error||settings.error)&&<p role="alert">{String((requests.error||token.error||settings.error)?.message)}</p>}
    {!id&&qr&&<><img src={qr} alt="AE shop QR" style={{width:'min(100%,300px)'}}/><p><a className="button secondary" href={qr} download="AE-shop-QR.png">{uiText('Download shop QR')}</a></p></>}
    {id&&!selected&&<p role="status">{requests.isPending?uiText('Loading request…'):uiText('This request is no longer pending. Check your transaction history before retrying.')}</p>}
    {selected&&settings.data&&<QrScanner key={selected.id} settings={settings.data} shopRequest={selected} mode={selected.action==='combined'?'redeem':'earn'}/>}
    {!id&&<><h2>{uiText('Pending customer requests')}</h2>{requests.data?.requests.map(row=><p key={row.id}><Link className="button secondary" to={'/shop-checkout?request='+row.id}>{uiText(row.action==='combined'?'Redeem + Earn':'Earn points')} · {row.customerCode.slice(0,3)}***</Link></p>)}{requests.data?.requests.length===0&&<p>{uiText('No pending requests')}</p>}</>}
  </section>;
}
export function ShopRequestAlert() {
  const [hidden,setHidden]=useState<string[]>([]);
  const query=useQuery({queryKey:['shop-requests'],queryFn:()=>apiFetch<{requests:Request[]}>('/api/merchant/shop-requests'),refetchInterval:5000});
  const row=query.data?.requests.find(item=>!hidden.includes(item.id));
  return <><p style={{padding:'8px 16px'}}><Link to="/shop-checkout">{uiText('Shop QR and checkout requests')}</Link></p>{row&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Customer checkout request"><h2>{uiText('Customer checkout request')}</h2><p>{uiText(row.action==='combined'?'Redeem + Earn':'Earn points')}</p><Link className="button primary" to={'/shop-checkout?request='+row.id} onClick={()=>setHidden(items=>[...items,row.id])}>{uiText('Open checkout')}</Link><button className="button secondary" onClick={()=>setHidden(items=>[...items,row.id])}>{uiText('Later')}</button></section></div>}</>;
}
export function CustomerShopScan() {
  const [payload,setPayload]=useState<{merchantId:string;token:string}|null>(null),[action,setAction]=useState<'earn'|'combined'>('earn'),[requestId,setRequestId]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const scanner=useRef<Html5Qrcode|null>(null);const accepted=useRef(false);
  useEffect(()=>()=>{if(scanner.current?.isScanning)void scanner.current.stop().catch(()=>{});},[]);
  const request=useQuery({queryKey:['customer-shop-request',requestId],enabled:!!requestId,queryFn:()=>apiFetch<{request:Request}>('/api/customer/shop-requests/'+requestId),refetchInterval:5000});
  async function start(){setError('');setBusy(true);accepted.current=false;try{const camera=new Html5Qrcode('ae-shop-reader');scanner.current=camera;await camera.start({facingMode:'environment'},{fps:8,qrbox:220},decoded=>{if(accepted.current)return;try{const row=JSON.parse(decoded);if(row.kind!=='ae_shop'||!row.merchantId||!row.token)throw new Error();accepted.current=true;setPayload(row);void camera.stop().catch(()=>{});}catch{setError(uiText('Please scan the AE shop QR displayed by the merchant.'));}},()=>{});}catch{setError(uiText('Allow camera access, then try again.'));}finally{setBusy(false);}}
  async function send(){if(!payload)return;setBusy(true);setError('');try{const data=await apiFetch<{request:Request}>('/api/customer/shop-requests',{method:'POST',body:JSON.stringify({...payload,action})});setRequestId(data.request.id);}catch(error){setError(error instanceof Error?error.message:'Request failed');}finally{setBusy(false);}}
  return <section className="panel" style={{margin:16,padding:20}}><Link to="/customer/scan">{uiText('Back to my QR')}</Link><h1>{uiText('Scan shop QR')}</h1><p>{uiText('Your merchant confirms the bill. Scanning does not issue or deduct points.')}</p><div id="ae-shop-reader"/>{!payload&&<button className="button primary" disabled={busy} onClick={()=>void start()}>{uiText('Open camera')}</button>}
    {payload&&!requestId&&<><label>{uiText('Checkout action')}<select value={action} onChange={e=>setAction(e.target.value as 'earn'|'combined')}><option value="earn">{uiText('Earn points')}</option><option value="combined">{uiText('Redeem + Earn')}</option></select></label><button className="button primary" disabled={busy} onClick={()=>void send()}>{uiText('Send to merchant')}</button></>}
    {requestId&&<p role="status">{request.data?`${request.data.request.merchantName}: ${uiText(request.data.request.status)}`:uiText('Waiting for merchant…')}</p>}{(error||request.error)&&<p role="alert">{error||request.error?.message}</p>}
  </section>;
}
