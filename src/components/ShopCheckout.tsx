import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import type { RewardSettings, UserProfile } from '../types';
import { ArrowLeft, QrCode, ScanLine, Download, Share2, ChevronRight, User } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import './merchant-shop-qr.css';
import './customer-scanner.css';
import QrScanner from './QrScanner';

type Request = {id:string;customerCode:string;merchantName:string;action:'earn'|'combined';status:string;expiresAt:number};
export function MerchantShopCheckout() {
  const [params]=useSearchParams();const id=params.get('request');const scan=params.get('scan')==='1';const [qr,setQr]=useState('');const [assetError,setAssetError]=useState('');
  const profile=useQuery({queryKey:['shop-qr-profile'],queryFn:()=>apiFetch<{data:{name:string}}>('/api/merchant-profile')});
  const requests=useQuery({queryKey:['shop-requests'],queryFn:()=>apiFetch<{requests:Request[]}>('/api/merchant/shop-requests'),refetchInterval:5000});
  const settings=useQuery({queryKey:['reward-settings'],queryFn:()=>apiFetch<RewardSettings>('/api/settings/reward')});
  const token=useQuery({queryKey:['shop-qr'],queryFn:()=>apiFetch<{payload:string}>('/api/merchant/shop-qr')});
  useEffect(()=>{let active=true;if(token.data)void QRCode.toDataURL(token.data.payload,{width:600,margin:3,errorCorrectionLevel:'H'}).then(value=>{if(active)setQr(value);}).catch(()=>{if(active)setAssetError('Unable to generate shop QR. Please retry.');});return()=>{active=false;};},[token.data]);
  async function shareQr(){if(!qr)return;setAssetError('');try{if(Capacitor.isNativePlatform()){const file=await Filesystem.writeFile({path:'AE-shop-QR.png',data:qr.split(',')[1],directory:Directory.Cache});await Share.share({title:'AE Shop QR',files:[file.uri]});}else{const blob=await(await fetch(qr)).blob();const file=new File([blob],'AE-shop-QR.png',{type:'image/png'});if(navigator.canShare?.({files:[file]}))await navigator.share({title:'AE Shop QR',files:[file]});else setAssetError('Sharing is not supported in this browser. Use Download QR instead.');}}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setAssetError('Unable to share QR. Use Download QR instead.');}}
  const selected=requests.data?.requests.find(row=>row.id===id);
  return <section className="ae-merchant-shop-qr"><header><Link to="/dashboard" aria-label="Back to dashboard"><ArrowLeft/></Link><h1>{uiText('Shop QR')}</h1><QrCode/></header><img className="ae-shop-brand" src="/logo.png" alt="AE"/>
    {(requests.error||token.error||settings.error)&&<p role="alert">{String((requests.error||token.error||settings.error)?.message)}</p>}
    {assetError&&<p role="alert">{assetError}</p>}
    {!id&&!scan&&<><div className="ae-shop-qr-card"><h2>{profile.data?.data.name||'Your Store'}</h2><span className="ae-shop-badge">Merchant QR</span>{qr?<img className="ae-shop-code" src={qr} alt="AE shop QR"/>:<p role="status">{token.isError?'Shop QR unavailable':'Loading shop QR…'}</p>}<h3>Let customers scan your shop QR</h3><p>Confirm the bill before issuing or redeeming points.</p><div className="ae-shop-actions"><a href={qr||undefined} download="AE-shop-QR.png" aria-disabled={!qr} onClick={e=>{if(!qr)e.preventDefault();}}><Download size={18}/>Download QR</a><button disabled={!qr} onClick={()=>void shareQr()}><Share2 size={18}/>Share QR</button></div></div><Link className="ae-shop-scan" to="/shop-checkout?scan=1"><ScanLine/>Scan Customer QR</Link></>}
    {scan&&<><Link to="/shop-checkout">Back to Shop QR</Link>{settings.data&&<QrScanner settings={settings.data} mode="earn"/>}</>}
    {id&&!selected&&<p role="status">{requests.isPending?uiText('Loading request…'):uiText('This request is no longer pending. Check your transaction history before retrying.')}</p>}
    {selected&&settings.data&&<QrScanner key={selected.id} settings={settings.data} shopRequest={selected} mode={selected.action==='combined'?'redeem':'earn'}/>}
    {!id&&!scan&&<div className="ae-shop-requests"><h2>Pending requests <span>{requests.data?.requests.length??'—'}</span></h2>{requests.data?.requests.map(row=><Link key={row.id} to={'/shop-checkout?request='+row.id}><User size={22}/><span>Customer {row.customerCode.slice(0,3)}***</span><small className={row.action==='combined'?'redeem':''}>{row.action==='combined'?'Redeem + Earn':'Issue Points'}</small><ChevronRight size={18}/></Link>)}{requests.isPending&&<p>Loading requests…</p>}{requests.data?.requests.length===0&&<p>No pending requests</p>}</div>}
    <footer>Points change only after your confirmation.</footer>
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
  const action:'earn'|'combined'=params.get('mode')==='redeem'?'combined':'earn';
  const modeLabel=action==='combined'?'Redeem Points':'Claim Points';
  const [payload,setPayload]=useState<{merchantId:string;token:string}|null>(null),[requestId,setRequestId]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[sending,setSending]=useState(false);
  const sendingRef=useRef(false);
  const scanner=useRef<Html5Qrcode|null>(null);const accepted=useRef(false);
  useEffect(()=>()=>{if(scanner.current?.isScanning)void scanner.current.stop().catch(()=>{});},[]);
  useEffect(()=>{let active=true;void QRCode.toDataURL(JSON.stringify({id:user.customer_code||user.id,transactionMode:action}),{width:320,margin:3,color:{dark:'#101a37',light:'#ffffff'}}).then(value=>{if(active)setQr(value);}).catch(()=>{if(active)setError('Unable to create QR. Please retry.');});return()=>{active=false;};},[user.id,user.customer_code,action]);
  const request=useQuery({queryKey:['customer-shop-request',requestId],enabled:!!requestId,queryFn:()=>apiFetch<{request:Request}>('/api/customer/shop-requests/'+requestId),refetchInterval:5000});
  async function start(){if(scanner.current?.isScanning||sendingRef.current)return;setError('');setBusy(true);accepted.current=false;try{const camera=new Html5Qrcode('ae-shop-reader');scanner.current=camera;await camera.start({facingMode:'environment'},{fps:8,qrbox:220},decoded=>{if(accepted.current)return;try{const row=JSON.parse(decoded);if(row.kind!=='ae_shop'||typeof row.merchantId!=='string'||typeof row.token!=='string')throw new Error();accepted.current=true;setPayload(row);void camera.stop().catch(()=>{});void send(row);}catch{setError(uiText('Please scan the AE shop QR displayed by the merchant.'));}},()=>{});if(showQrRef.current||disposed.current)await camera.stop();}catch{setError(uiText('Allow camera access, then try again.'));}finally{setBusy(false);}}
  const showQrRef=useRef(false),disposed=useRef(false);
  useEffect(()=>{disposed.current=false;const timer=setTimeout(()=>void start(),0);return()=>{clearTimeout(timer);disposed.current=true;};},[]);
  async function toggleQr(){const next=!showQr;showQrRef.current=next;setShowQr(next);if(next&&scanner.current?.isScanning)await scanner.current.stop().catch(()=>{});else if(!next&&!payload&&!requestId)void start();}
  async function send(shop=payload){if(!shop||sendingRef.current||requestId)return;sendingRef.current=true;setSending(true);setError('');try{const data=await apiFetch<{request:Request}>('/api/customer/shop-requests',{method:'POST',body:JSON.stringify({merchantId:shop.merchantId,token:shop.token,action})});setRequestId(data.request.id);}catch(error){setError(error instanceof Error?error.message:'Request failed');}finally{sendingRef.current=false;setSending(false);}}
  return <section className={`ae-customer-scanner ${showQr?'show-qr':''}`}><header><Link to="/customer/home" aria-label="Back to home"><ArrowLeft/></Link><h1>{showQr?'My QR':'Scan QR'}</h1><button disabled={busy} onClick={()=>void toggleQr()}>{showQr?<ScanLine size={18}/>:<QrCode size={18}/>} {showQr?'Scan QR':'Show My QR'}</button></header>
    <div className="ae-scan-fixed-mode"><h2>{modeLabel}</h2><p>Scanning sends your {modeLabel.toLowerCase()} request to the merchant automatically.</p></div>
    <div className="ae-scan-camera" style={{display:showQr?'none':'block'}}><div id="ae-shop-reader"/><p>Scan the merchant QR code</p>{!payload&&!requestId&&<button disabled={busy} onClick={()=>void start()}>{busy?'Opening camera…':'Retry camera'}</button>}</div>
    {showQr&&<div className="ae-my-qr-card"><img src="/logo.png" className="ae-scan-logo" alt="AE"/><h2>Show this QR to the merchant</h2><p>{action==='combined'?'Redeem + Earn · Merchant confirmation required':'Issue points · Merchant confirmation required'}</p>{qr&&<img src={qr} alt="Your customer QR"/>}<button onClick={()=>void toggleQr()}>Back to scanner</button></div>}
    {payload&&!requestId&&!showQr&&<div className="ae-scan-result"><p role="status">{sending?'Sending request to merchant…':'Request was not sent. Please retry.'}</p>{!sending&&<button onClick={()=>void send()}>Retry {modeLabel} request</button>}</div>}
    {requestId&&<p role="status">{request.data?`${request.data.request.merchantName}: ${uiText(request.data.request.status)}`:uiText('Waiting for merchant…')}</p>}{(error||request.error)&&<p role="alert">{error||request.error?.message}</p>}
    <footer>Points change only after merchant confirmation.</footer>
  </section>;
}
