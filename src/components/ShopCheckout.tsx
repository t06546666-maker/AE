import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import { useTranslation } from 'react-i18next';
import type { RewardSettings, UserProfile } from '../types';
import { ArrowLeft, QrCode, ScanLine, Download, Share2, ChevronRight, User } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import './merchant-shop-qr.css';
import './customer-scanner.css';
import QrScanner from './QrScanner';

type Request = {id:string;customerCode:string;merchantName:string;action:'earn'|'combined';status:string;expiresAt:number;counterFlow?:boolean;amount?:number;revision?:number;reason?:string;quote?:{discountAmount:number;payable:number;pointsToEarn:number;pointsToRedeem:number}};
// Foreground fallback for web users or delayed FCM. React Query pauses it in
// background tabs; push still invalidates this query immediately on phones.
const REQUEST_POLL_MS = 1500;
export function MerchantShopCheckout() {
  useTranslation();
  const [params]=useSearchParams();const id=params.get('request');const scan=params.get('scan')==='1';const [qr,setQr]=useState('');const [assetError,setAssetError]=useState('');
  const profile=useQuery({queryKey:['shop-qr-profile'],queryFn:()=>apiFetch<{data:{name:string}}>('/api/merchant-profile')});
  const requests=useQuery({queryKey:id?['shop-requests',id]:['shop-requests'],queryFn:({signal})=>apiFetch<{requests:Request[]}>('/api/merchant/shop-requests'+(id?'?requestId='+encodeURIComponent(id):''),{signal}),refetchInterval:REQUEST_POLL_MS});
  const settings=useQuery({queryKey:['reward-settings'],queryFn:()=>apiFetch<RewardSettings>('/api/settings/reward')});
  const token=useQuery({queryKey:['shop-qr'],queryFn:()=>apiFetch<{payload:string}>('/api/merchant/shop-qr')});
  useEffect(()=>{let active=true;if(token.data)void QRCode.toDataURL(token.data.payload,{width:600,margin:3,errorCorrectionLevel:'H'}).then(value=>{if(active)setQr(value);}).catch(()=>{if(active)setAssetError('Unable to generate shop QR. Please retry.');});return()=>{active=false;};},[token.data]);
  async function shareQr(){if(!qr)return;setAssetError('');try{if(Capacitor.isNativePlatform()){const file=await Filesystem.writeFile({path:'AE-shop-QR.png',data:qr.split(',')[1],directory:Directory.Cache});await Share.share({title:'AE Shop QR',files:[file.uri]});}else{const blob=await(await fetch(qr)).blob();const file=new File([blob],'AE-shop-QR.png',{type:'image/png'});if(navigator.canShare?.({files:[file]}))await navigator.share({title:'AE Shop QR',files:[file]});else setAssetError('Sharing is not supported in this browser. Use Download QR instead.');}}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setAssetError('Unable to share QR. Use Download QR instead.');}}
  const selected=requests.data?.requests.find(row=>row.id===id);
  return <section className="ae-merchant-shop-qr"><header><Link to="/dashboard" aria-label={uiText("Back to dashboard")}><ArrowLeft/></Link><QrCode/></header><img className="ae-shop-brand" src="/logo.png" alt="AE"/>
    {(requests.error||token.error||settings.error)&&<p role="alert">{String((requests.error||token.error||settings.error)?.message)}</p>}
    {assetError&&<p role="alert">{uiText(assetError)}</p>}
    {!id&&!scan&&<><div className="ae-shop-qr-card"><h2>{profile.data?.data.name||uiText('Your Store')}</h2><span className="ae-shop-badge">{uiText('Merchant QR')}</span>{qr?<img className="ae-shop-code" src={qr} alt="AE shop QR"/>:<p role="status">{uiText(token.isError?'Shop QR unavailable':'Loading shop QR…')}</p>}<h3>{uiText('Let customers scan your shop QR')}</h3><p>{uiText('Confirm the bill before issuing or redeeming points.')}</p><div className="ae-shop-actions"><a href={qr||undefined} download="AE-shop-QR.png" aria-disabled={!qr} onClick={e=>{if(!qr)e.preventDefault();}}><Download size={18}/>{uiText('Download QR')}</a><button disabled={!qr} onClick={()=>void shareQr()}><Share2 size={18}/>{uiText('Share QR')}</button></div></div><Link className="ae-shop-scan" to="/shop-checkout?scan=1"><ScanLine/>{uiText('Scan Customer QR')}</Link></>}
    {scan&&<><Link to="/shop-checkout">{uiText('Back to Shop QR')}</Link>{settings.data&&<QrScanner settings={settings.data} mode="earn"/>}</>}
    {id&&!selected&&<p role="status">{requests.isPending?uiText('Loading request…'):uiText('This request is no longer pending. Check your transaction history before retrying.')}</p>}
    {selected&&settings.data&&<QrScanner key={selected.id} settings={settings.data} shopRequest={selected} mode={selected.action==='combined'?'redeem':'earn'}/>}
    {!id&&!scan&&<div className="ae-shop-requests"><h2>{uiText('Pending requests')} <span>{requests.data?.requests.length??'—'}</span></h2>{requests.data?.requests.map(row=><Link key={row.id} to={'/shop-checkout?request='+row.id}><User size={22}/><span>{uiText('Customer')} {row.customerCode.slice(0,3)}***</span><small className={row.action==='combined'?'redeem':''}>{uiText(row.action==='combined'?'Redeem + Earn':'Issue Points')}</small><ChevronRight size={18}/></Link>)}{requests.isPending&&<p>{uiText('Loading requests…')}</p>}{requests.data?.requests.length===0&&<p>{uiText('No pending requests')}</p>}</div>}
    <footer>{uiText('Points change only after your confirmation.')}</footer>
  </section>;
}
export function ShopRequestAlert() {
  const [hidden,setHidden]=useState<string[]>([]);
  const query=useQuery({queryKey:['shop-requests'],queryFn:({signal})=>apiFetch<{requests:Request[]}>('/api/merchant/shop-requests',{signal}),refetchInterval:REQUEST_POLL_MS});
  const row=query.data?.requests.find(item=>!hidden.includes(item.id));
  return <>{row&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label={uiText('Customer checkout request')}><h2>{uiText('Customer checkout request')}</h2><p>{uiText(row.action==='combined'?'Redeem + Earn':'Issue points')}</p><Link className="button primary" to={'/shop-checkout?request='+row.id} onClick={()=>setHidden(items=>[...items,row.id])}>{uiText('Open checkout')}</Link><button className="button secondary" onClick={()=>setHidden(items=>[...items,row.id])}>{uiText('Later')}</button></section></div>}</>;
}
export function CustomerShopScan({user}: {user:UserProfile}) {
  const [params,setParams]=useSearchParams();
  const [billAmount,setBillAmount]=useState(''),[counterOptions,setCounterOptions]=useState<{enabled:boolean;merchantName:string}|null>(null);
  const [showQr,setShowQr]=useState(false),[qr,setQr]=useState('');
  const action:'earn'|'combined'=params.get('mode')==='redeem'?'combined':'earn';
  const modeLabel=action==='combined'?'Redeem Points':'Claim Points';
  const [payload,setPayload]=useState<{merchantId:string;token:string}|null>(null),[requestId,setRequestId]=useState(params.get('request')||''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[sending,setSending]=useState(false);
  const sendingRef=useRef(false);
  const scanner=useRef<Html5Qrcode|null>(null);const accepted=useRef(false);
  useEffect(()=>()=>{if(scanner.current?.isScanning)void scanner.current.stop().catch(()=>{});},[]);
  useEffect(()=>{let active=true;void QRCode.toDataURL(JSON.stringify({id:user.customer_code||user.id,transactionMode:action}),{width:320,margin:3,color:{dark:'#101a37',light:'#ffffff'}}).then(value=>{if(active)setQr(value);}).catch(()=>{if(active)setError('Unable to create QR. Please retry.');});return()=>{active=false;};},[user.id,user.customer_code,action]);
  const request=useQuery({queryKey:['customer-shop-request',requestId],enabled:!!requestId,queryFn:()=>apiFetch<{request:Request}>('/api/customer/shop-requests/'+requestId),refetchInterval:5000});
  async function start(){if(scanner.current?.isScanning||sendingRef.current)return;setError('');setBusy(true);accepted.current=false;try{const camera=new Html5Qrcode('ae-shop-reader');scanner.current=camera;await camera.start({facingMode:'environment'},{fps:8,qrbox:220},decoded=>{if(accepted.current)return;try{const row=JSON.parse(decoded);if(row.kind!=='ae_shop'||typeof row.merchantId!=='string'||typeof row.token!=='string')throw new Error();accepted.current=true;setPayload(row);void camera.stop().catch(()=>{});void send(row);}catch{setError(uiText('Please scan the AE shop QR displayed by the merchant.'));}},()=>{});if(showQrRef.current||disposed.current)await camera.stop();}catch{setError(uiText('Allow camera access, then try again.'));}finally{setBusy(false);}}
  const showQrRef=useRef(false),disposed=useRef(false);
  useEffect(()=>{disposed.current=false;const timer=setTimeout(()=>{if(!requestId)void start();},0);return()=>{clearTimeout(timer);disposed.current=true;};},[]);
  async function toggleQr(){const next=!showQr;showQrRef.current=next;setShowQr(next);if(next&&scanner.current?.isScanning)await scanner.current.stop().catch(()=>{});else if(!next&&!payload&&!requestId)void start();}
  async function send(shop=payload,withAmount=false){if(!shop||sendingRef.current||requestId)return;sendingRef.current=true;setSending(true);setError('');try{
    const options=await apiFetch<{enabled:boolean;merchantName:string}>('/api/customer/counter-checkout/options?merchantId='+encodeURIComponent(shop.merchantId)+'&token='+encodeURIComponent(shop.token));setCounterOptions(options);
    if(options.enabled&&!withAmount)return;
    const data=await apiFetch<{request:Request}>('/api/customer/shop-requests',{method:'POST',body:JSON.stringify({merchantId:shop.merchantId,token:shop.token,action,...(options.enabled?{amount:billAmount}:{})})});setRequestId(data.request.id);setParams({request:data.request.id,mode:action==='combined'?'redeem':'earn'});
   }catch(error){setError(error instanceof Error?error.message:'Request failed');}finally{sendingRef.current=false;setSending(false);}}
  async function resubmit(){if(!request.data)return;setSending(true);setError('');try{await apiFetch('/api/customer/counter-requests/'+requestId+'/resubmit',{method:'POST',body:JSON.stringify({amount:billAmount,revision:request.data.request.revision})});setBillAmount('');await request.refetch();}catch(e){setError(e instanceof Error?e.message:'Could not resubmit.');}finally{setSending(false);}}

  return <section className={`ae-customer-scanner ${showQr?'show-qr':''}`}><header><Link to="/customer/home" aria-label="Back to home"><ArrowLeft/></Link><h1>{showQr?'My QR':modeLabel}</h1><button disabled={busy} onClick={()=>void toggleQr()}>{showQr?<ScanLine size={18}/>:<QrCode size={18}/>} {showQr?'Scan QR':'My QR'}</button></header>
    <div className="ae-scan-camera" style={{display:showQr?'none':'block'}}><div id="ae-shop-reader"/><p>Scan the shop QR</p>{busy&&<p role="status">Opening camera…</p>}</div>
    {showQr&&<div className="ae-my-qr-card"><img src="/logo.png" className="ae-scan-logo" alt="AE"/><h2>Show this QR to the merchant</h2><p>{action==='combined'?'Redeem + Earn · Merchant confirmation required':'Issue points · Merchant confirmation required'}</p>{qr&&<img src={qr} alt="Your customer QR"/>}<button onClick={()=>void toggleQr()}>Back to scanner</button></div>}
    {payload&&!requestId&&!showQr&&counterOptions?.enabled&&<form className="ae-scan-result" onSubmit={e=>{e.preventDefault();void send(payload,true);}}><h2>{counterOptions.merchantName}</h2><label>{uiText('Enter your bill amount (₹)')}<input type="number" min="1" step="0.01" value={billAmount} onChange={e=>setBillAmount(e.target.value)} required/></label><p>{uiText('Counter Staff will check the amount. The merchant’s discount and points rules will be applied.')}</p><button className="button primary" disabled={sending}>{uiText(sending?'Sending…':'Send for amount confirmation')}</button></form>}
    {payload&&!requestId&&!showQr&&!counterOptions?.enabled&&<div className="ae-scan-result"><p role="status">{sending?'Sending request to the merchant…':'The request was not sent. Return to the scanner and try again.'}</p></div>}
    {requestId&&<div className="ae-scan-status" role="status"><strong>{uiText(request.data?.request.status==='correction_requested'?'Amount correction requested':request.data?.request.status==='cancelled'?'Checkout cancelled':request.data?.request.status==='completed'?(request.data.request.counterFlow?'Amount confirmed':'Checkout confirmed'):'Request sent')}</strong><p>{request.data?request.data.request.merchantName+': '+uiText(request.data.request.status):uiText('Waiting for confirmation…')}</p>{request.data?.request.reason&&<p>{request.data.request.reason}</p>}{request.data?.request.status==='correction_requested'&&<form onSubmit={e=>{e.preventDefault();void resubmit();}}><label>{uiText('Correct bill amount (₹)')}<input type="number" min="1" step="0.01" value={billAmount} onChange={e=>setBillAmount(e.target.value)} required/></label><button className="button primary" disabled={sending}>{uiText('Resubmit corrected amount')}</button></form>}{request.data?.request.quote&&<p>{uiText('Bill')}: ₹{request.data.request.amount?.toFixed(2)} · {uiText('Discount')}: ₹{request.data.request.quote.discountAmount.toFixed(2)} · {uiText('Payable')}: ₹{request.data.request.quote.payable.toFixed(2)}</p>}{request.data?.request.status==='completed'&&request.data.request.counterFlow&&<p>{uiText('The amount was confirmed. This is not proof of payment receipt.')}</p>}{['cancelled','expired'].includes(request.data?.request.status||'')&&<Link to={'/customer/shop-scan?mode='+(action==='combined'?'redeem':'earn')}>{uiText('Start a new checkout')}</Link>}</div>}{(error||request.error)&&<p role="alert">{error||request.error?.message}</p>}

    <footer>{uiText(counterOptions?.enabled||request.data?.request.counterFlow?'Enter the bill amount for Counter Staff confirmation.':'Your request will be sent automatically.')}<br/>{uiText('Merchant confirmation is required.')}</footer>
  </section>;
}
