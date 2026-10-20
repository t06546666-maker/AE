import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from '../components/Common';
import posterCss from './merchant-qr-poster.css?inline';
import './merchant-qr-poster.css';

const defaults=['നമ്മുടെ നാട്','നമ്മുടെ സ്ഥാപനം','നമ്മുടെ നേട്ടങ്ങൾ'];
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

export function MerchantQrPoster() {
  const {id=''}=useParams();const {i18n}=useTranslation();const ml=i18n.language.startsWith('ml');
  const text=(en:string,malayalam:string)=>ml?malayalam:en;
  const [lines,setLines]=useState(defaults),[scan,setScan]=useState('സ്കാൻ ചെയ്യൂ'),[qr,setQr]=useState(''),[error,setError]=useState(''),[exporting,setExporting]=useState(false);
  const result=useQuery({queryKey:['admin-qr-poster',id],queryFn:({signal})=>apiFetch<{merchant:{id:string;name:string;merchant_code:string};payload:string}>(`/api/admin/merchants/${encodeURIComponent(id)}/qr-poster`,{signal}),staleTime:0,gcTime:0});
  useEffect(()=>{let active=true;setQr('');setError('');if(result.data)void QRCode.toString(result.data.payload,{type:'svg',margin:4,errorCorrectionLevel:'H'}).then(svg=>{if(active)setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);}).catch(()=>{if(active)setError('Unable to generate QR. Please retry.');});return()=>{active=false;};},[result.data]);
  const valid=!!qr && lines.every(line=>line.trim()) && !!scan.trim();
  async function exportPoster(print:boolean) {
    if(!valid||!result.data)return;
    const paper=document.querySelector('.ae-poster-page .ae-poster-paper');
    if(paper&&Array.from(paper.children).some(child=>!child.classList.contains('ae-poster-wave')&&child.getBoundingClientRect().bottom>paper.getBoundingClientRect().bottom-12)){setError(text('The text does not fit A5. Shorten the headline or shop name before printing.','വാചകം A5-ൽ ഒതുങ്ങുന്നില്ല. പ്രിന്റ് ചെയ്യുന്നതിന് മുമ്പ് തലക്കെട്ടോ സ്ഥാപനത്തിന്റെ പേരോ ചുരുക്കുക.'));return;}
    const popup=print?window.open('','_blank'):null;
    if(print&&!popup){setError(text('Allow pop-ups to open the print preview.','പ്രിന്റ് പ്രിവ്യൂ തുറക്കാൻ പോപ്പ്-അപ്പുകൾ അനുവദിക്കുക.'));return;}
    setExporting(true);setError('');
    try {
      const response=await fetch('/logo.png');if(!response.ok)throw new Error('Logo unavailable');
      const logo=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;void response.blob().then(blob=>reader.readAsDataURL(blob)).catch(reject);});
      const html=`<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>${escapeHtml(result.data.merchant.name)} - AE A5</title><style>${posterCss}</style></head><body class="ae-poster-export"><article class="ae-counter-poster"><div class="ae-poster-paper"><img class="ae-poster-logo" src="${logo}" alt="AE"><div class="ae-poster-divider"></div><h1 class="ae-poster-headline">${lines.map(line=>`<span>${escapeHtml(line)}</span>`).join('')}</h1><div class="ae-poster-scan">${escapeHtml(scan)}</div><div class="ae-poster-qr"><img src="${qr}" alt="Merchant QR"></div><div class="ae-poster-shop">${escapeHtml(result.data.merchant.name)}</div><div class="ae-poster-divider"></div><div class="ae-poster-wave"></div></div></article></body></html>`;
      if(popup){popup.document.open();popup.document.write(html);popup.document.close();await Promise.all(Array.from(popup.document.images).map(img=>img.decode()));await popup.document.fonts.ready;popup.focus();popup.print();}
      else {const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`AE-A5-${result.data.merchant.merchant_code.replace(/[^a-zA-Z0-9_-]/g,'')}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
    }catch{popup?.close();setError(text('Unable to prepare poster. Please retry.','പോസ്റ്റർ തയ്യാറാക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.'));}
    finally{setExporting(false);}
  }
  if(result.isPending)return <LoadingState/>;
  if(result.isError)return <ErrorState error={result.error} retry={()=>void result.refetch()}/>;
  return <div className="ae-poster-page"><Link className="button secondary" to={`/merchants/${encodeURIComponent(id)}`}>{text('Back to merchant','സ്ഥാപനത്തിലേക്ക് മടങ്ങുക')}</Link><h1>{text('QR Poster','QR പോസ്റ്റർ')}</h1><p>{result.data.merchant.name} · {result.data.merchant.merchant_code}</p><div className="ae-poster-workspace"><section className="panel ae-poster-editor"><h2>{text('A5 counter display','A5 കൗണ്ടർ പോസ്റ്റർ')}</h2><p>148 × 210 mm</p>{lines.map((line,index)=><label key={index}>{text(`Headline · Line ${index+1}`,`തലക്കെട്ട് · വരി ${index+1}`)}<input maxLength={26} value={line} onChange={e=>setLines(old=>old.map((v,i)=>i===index?e.target.value:v))}/></label>)}<label>{text('Scan instruction','സ്കാൻ നിർദ്ദേശം')}<input maxLength={24} value={scan} onChange={e=>setScan(e.target.value)}/></label><label>{text('Shop name (from merchant profile)','സ്ഥാപനത്തിന്റെ പേര് (പ്രൊഫൈലിൽ നിന്ന്)')}<input readOnly value={result.data.merchant.name}/></label><p>{text('This is the same shop QR used in the merchant app. Editing the headline does not change the QR.','മെർച്ചന്റ് ആപ്പിലെ അതേ സ്ഥാപന QR ആണ് ഇത്. തലക്കെട്ട് മാറ്റിയാലും QR മാറില്ല.')}</p><button className="button primary" disabled={!valid||exporting} onClick={()=>void exportPoster(true)}>{text('Print / Save PDF','പ്രിന്റ് / PDF ആയി സൂക്ഷിക്കുക')}</button><button className="button secondary" disabled={!valid||exporting} onClick={()=>void exportPoster(false)}>{text('Download printable poster','പ്രിന്റ് ചെയ്യാവുന്ന പോസ്റ്റർ ഡൗൺലോഡ്')}</button><p>{text('Choose A5, actual size (100%), no margins, and background graphics. Test-scan the printed copy in the AE customer app.','A5, യഥാർത്ഥ വലുപ്പം (100%), മാർജിൻ ഇല്ല, പശ്ചാത്തല ഗ്രാഫിക്സ് എന്നിവ തിരഞ്ഞെടുക്കുക. പ്രിന്റ് ചെയ്ത QR, AE കസ്റ്റമർ ആപ്പിൽ സ്കാൻ ചെയ്ത് പരിശോധിക്കുക.')}</p>{error&&<p role="alert">{error}</p>}</section><section className="ae-poster-preview" aria-label={text('Poster preview','പോസ്റ്റർ പ്രിവ്യൂ')}><article className="ae-counter-poster"><div className="ae-poster-paper"><img className="ae-poster-logo" src="/logo.png" alt="AE"/><div className="ae-poster-divider"/><h2 className="ae-poster-headline">{lines.map((line,i)=><span key={i}>{line}</span>)}</h2><div className="ae-poster-scan">{scan}</div><div className="ae-poster-qr">{qr?<img src={qr} alt={text('Merchant QR','സ്ഥാപന QR')}/>:<span role="status">{text('Preparing QR…','QR തയ്യാറാക്കുന്നു…')}</span>}</div><div className="ae-poster-shop">{result.data.merchant.name}</div><div className="ae-poster-divider"/><div className="ae-poster-wave"/></div></article></section></div></div>;
}
