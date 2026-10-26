import {useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Capacitor} from '@capacitor/core';
import {apiFetch} from '../api';
import {uiText as t} from '../uiText';
export function MerchantPushSetup({userId}:{userId:string}) {
 const [message,setMessage]=useState('');const client=useQueryClient();
 const status=useQuery({queryKey:['merchant-push-status',userId],queryFn:()=>apiFetch<{registered:boolean;enabled:boolean;firebaseReady:boolean}>('/api/merchant/push-status'),staleTime:30000});
 useEffect(()=>{const update=(event:Event)=>{setMessage((event as CustomEvent<string>).detail);void client.invalidateQueries({queryKey:['merchant-push-status',userId]});};window.addEventListener('ae:push-status',update);return()=>window.removeEventListener('ae:push-status',update);},[client,userId]);
 const test=useMutation({retry:false,mutationFn:()=>apiFetch<{message:string}>('/api/merchant/push-test',{method:'POST'}),onSuccess:result=>setMessage(result.message)});
 return <details className="panel" style={{marginBottom:16}}><summary>{t('Phone notifications')}{status.data&&!status.data.registered?` — ${t('Phone not connected')}`:''}</summary>
 <p>{t('Receive checkout alerts while AE is in the background. Tap an alert to open the checkout request.')}</p>
 {status.error&&<p role="alert">{status.error.message}</p>}
 {status.data&&<p>{t(!status.data.firebaseReady?'Notification server unavailable':!status.data.registered?'Phone not connected':!status.data.enabled?'Notifications disabled':'Phone registered for notifications.')}</p>}
 {Capacitor.isNativePlatform()?<button className="button secondary" onClick={()=>{setMessage(t('Connecting phone notifications…'));window.dispatchEvent(new Event('ae:register-push'));}}>{t('Connect phone notifications')}</button>:<p>{t('Open the installed AE app to connect this phone. The customer can send the checkout request from the website.')}</p>}
 <button className="button secondary" style={{margin:8}} disabled={test.isPending||!status.data?.registered||!status.data.enabled||!status.data.firebaseReady} onClick={()=>test.mutate()}>{t(test.isPending?'Sending…':'Send test notification')}</button>
 <button className="button secondary" onClick={()=>void status.refetch()}>{t('Refresh')}</button>
 {message&&<p role="status">{message}</p>}{test.error&&<p role="alert">{test.error.message}</p>}
 </details>;
}
