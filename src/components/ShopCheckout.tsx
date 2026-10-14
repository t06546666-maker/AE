import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import type { RewardSettings, UserProfile } from '../types';
import { ArrowLeft, QrCode, ScanLine } from 'lucide-react';
import './customer-scanner.css';
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
export function CustomerShopScan({user}: {user:UserProfile}) {
  const [params]=useSearchParams();
  const [showQr,setShowQr]=useState(false),[qr,setQr]=useState('');
  const [payload,setPayload]=useState<{merchantId:string;token:string}|null>(null),[action,setAction]=useState<'earn'|'combined'>(()=>params.get('mode')==='redeem'?'combined':'earn'),[requestId,setRequestId]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const scanner=useRef<Html5Qrcode|null>(null);const accepted=useRef(false);
  useEffect(()=>()=>{if(scanner.current?.isScanning)void scanner.current.stop().catch(()=>{});},[]);
  useEffect(()=>{let active=true;void QRCode.toDataURL(JSON.stringify({id:user.customer_code||user.id,transactionMode:action}),{width:320,margin:3,color:{dark:'#101a37',light:'#ffffff'}}).then(value=>{if(active)setQr(value);}).catch(()=>{if(active)setError('Unable to create QR. Please retry.');});return()=>{active=false;};},[user.id,user.customer_code,action]);
  const request=useQuery({queryKey:['customer-shop-request',requestId],enabled:!!requestId,queryFn:()=>apiFetch<{request:Request}>('/api/customer/shop-requests/'+requestId),refetchInterval:5000});
  async function start(){if(scanner.current?.isScanning)return;setError('');setBusy(true);accepted.current=false;try{const camera=new Html5Qrcode('ae-shop-reader');scanner.current=camera;await camera.start({facingMode:'environment'},{fps:8,qrbox:220},decoded=>{if(accepted.current)return;try{const row=JSON.parse(decoded);if(row.kind!=='ae_shop'||!row.merchantId||!row.token)throw new Error();accepted.current=true;setPayload(row);void camera.stop().catch(()=>{});}catch{setError(uiText('Please scan the AE shop QR displayed by the merchant.'));}},()=>{});if(showQrRef.current||disposed.current)await camera.stop();}catch{setError(uiText('Allow camera access, then try again.'));}finally{setBusy(false);}}
  const showQrRef=useRef(false),disposed=useRef(false);
  useEffect(()=>{disposed.current=false;const timer=setTimeout(()=>void start(),0);return()=>{clearTimeout(timer);disposed.current=true;};},[]);
  async function toggleQr(){const next=!showQr;showQrRef.current=next;setShowQr(next);if(next&&scanner.current?.isScanning)await scanner.current.stop().catch(()=>{});else if(!next&&!payload&&!requestId)void start();}
  async function send(){if(!payload)return;setBusy(true);setError('');try{const data=await apiFetch<{request:Request}>('/api/customer/shop-requests',{method:'POST',body:JSON.stringify({...payload,action})});setRequestId(data.request.id);}catch(error){setError(error instanceof Error?error.message:'Request failed');}finally{setBusy(false);}}
  return <section className={`ae-customer-scanner ${showQr?'show-qr':''}`}><header><Link to="/customer/home" aria-label="Back to home"><ArrowLeft/></Link><h1>{showQr?'My QR':'Scan QR'}</h1><button disabled={busy} onClick={()=>void toggleQr()}>{showQr?<ScanLine size={18}/>:<QrCode size={18}/>} {showQr?'Scan QR':'Show My QR'}</button></header>
    <div className="ae-scan-modes"><button disabled={!!requestId} aria-pressed={action==='earn'} onClick={()=>setAction('earn')}>Issue Points</button><button disabled={!!requestId} aria-pressed={action==='combined'} onClick={()=>setAction('combined')}>Redeem Points</button></div>
    <div className="ae-scan-camera" style={{display:showQr?'none':'block'}}><div id="ae-shop-reader"/><p>Scan the merchant QR code</p>{!payload&&!requestId&&<button disabled={busy} onClick={()=>void start()}>{busy?'Opening camera…':'Retry camera'}</button>}</div>
    {showQr&&<div className="ae-my-qr-card"><img src="/logo.png" className="ae-scan-logo" alt="AE"/><h2>Show this QR to the merchant</h2><p>{action==='combined'?'Redeem + Earn · Merchant confirmation required':'Issue points · Merchant confirmation required'}</p>{qr&&<img src={qr} alt="Your customer QR"/>}<button onClick={()=>void toggleQr()}>Back to scanner</button></div>}
    {payload&&!requestId&&!showQr&&<div className="ae-scan-result"><p>Shop QR detected. Confirm your request.</p><button disabled={busy} onClick={()=>void send()}>Send {action==='combined'?'Redeem + Earn':'Issue Points'} request</button></div>}
    {requestId&&<p role="status">{request.data?`${request.data.request.merchantName}: ${uiText(request.data.request.status)}`:uiText('Waiting for merchant…')}</p>}{(error||request.error)&&<p role="alert">{error||request.error?.message}</p>}
    <footer>Points change only after merchant confirmation.</footer>
  </section>;
}
