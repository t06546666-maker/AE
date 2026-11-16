import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiFetch} from '../api';
import {uiText} from '../uiText';

type Settings={upiId:string;qrUrl:string;enabled:boolean};
export function MerchantUpiSettings(){
 const query=useQuery({queryKey:['merchant-upi-settings'],queryFn:()=>apiFetch<Settings>('/api/merchant-profile/upi')});
 const [draft,setDraft]=useState<Settings|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const value=draft || query.data;
 async function save(){if(!value)return;setBusy(true);setMessage('');try{await apiFetch('/api/merchant-profile/upi',{method:'PUT',body:JSON.stringify({upiId:value.upiId,enabled:value.enabled})});setMessage(uiText('Payment settings saved.'));await query.refetch();}catch(e){setMessage(e instanceof Error?e.message:uiText('Could not save payment settings.'));}finally{setBusy(false);}}
 async function upload(file?:File){if(!file)return;setBusy(true);setMessage('');try{const body=new FormData();body.append('image',file);const result=await apiFetch<{qrUrl:string}>('/api/merchant-profile/upi/qr',{method:'POST',body});setDraft(current=>({...current || value || {upiId:'',enabled:false,qrUrl:''},qrUrl:result.qrUrl}));await query.refetch();setMessage(uiText('QR image saved.'));}catch(e){setMessage(e instanceof Error?e.message:uiText('Could not save QR image.'));}finally{setBusy(false);}}
 return <section className="panel"><h2>{uiText('UPI payment settings')}</h2><p>{uiText('Internal testing: add your shop’s UPI ID and payment QR. Verify the recipient in your UPI app before paying.')}</p>{query.isPending?<p>{uiText('Loading…')}</p>:query.isError?<><p role="alert">{uiText('Could not load payment settings.')}</p><button className="button secondary" onClick={()=>void query.refetch()}>{uiText('Retry')}</button></>:value&&<>
 <label style={{display:'grid',gap:8,margin:'16px 0'}}>{uiText('Shop UPI ID')}<input value={value.upiId} maxLength={193} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="shop@bank" disabled={busy} onChange={e=>setDraft({...value,upiId:e.target.value})}/></label>
 <label style={{display:'flex',gap:10,alignItems:'center',margin:'16px 0'}}><input type="checkbox" checked={value.enabled} disabled={busy} onChange={e=>setDraft({...value,enabled:e.target.checked})}/>{uiText('Enable UPI payment links for this shop')}</label>
 <label style={{display:'grid',gap:8,margin:'16px 0'}}>{uiText('Shop payment QR image')}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label>
 {value.qrUrl&&<a href={value.qrUrl} target="_blank" rel="noopener noreferrer"><img src={value.qrUrl} alt={uiText('Shop payment QR')} style={{width:200,maxWidth:'100%',height:200,objectFit:'contain',background:'#fff'}}/></a>}
 <p>{uiText('The uploaded QR must belong to the same UPI ID. AE does not verify payment receipt.')}</p><button className="button primary" disabled={busy} onClick={()=>void save()}>{busy?uiText('Saving…'):uiText('Save payment settings')}</button></>}{message&&<p role="status">{message}</p>}</section>;
}
