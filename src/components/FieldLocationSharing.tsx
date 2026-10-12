import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Geolocation } from '@capacitor/geolocation';
import { apiFetch } from '../api';
import { uiText } from '../uiText';

export function FieldLocationSharing({managerId}:{managerId:string}){
 const key=`ae-field-location-sharing:${managerId}`;
 const [enabled,setEnabled]=useState(()=>localStorage.getItem(key)==='true');
 const [visible,setVisible]=useState(!document.hidden),[nativeActive,setNativeActive]=useState(!Capacitor.isNativePlatform());
 const [error,setError]=useState('');
 const foreground=visible&&nativeActive;
 const work=useQuery({queryKey:['field-attendance','location-status',managerId],queryFn:()=>apiFetch<{active:boolean}>('/api/field/location/status'),enabled:foreground,refetchInterval:30000,refetchIntervalInBackground:false});
 useEffect(()=>{
  let alive=true;let listener:{remove:()=>Promise<void>}|undefined;
  const visibility=()=>setVisible(!document.hidden);
  document.addEventListener('visibilitychange',visibility);
  if(Capacitor.isNativePlatform()){
   App.getState().then(state=>{if(alive)setNativeActive(state.isActive);});
   App.addListener('appStateChange',state=>{if(alive)setNativeActive(state.isActive);}).then(handle=>{if(alive)listener=handle;else void handle.remove();});
  }
  return()=>{alive=false;document.removeEventListener('visibilitychange',visibility);void listener?.remove();};
 },[]);
 useEffect(()=>{
  let alive=true,busy=false;
  const allowed=()=>alive&&!document.hidden&&foreground&&enabled&&work.data?.active===true;
  async function sample(){
   if(!allowed()||busy)return;busy=true;
   try{
    // Recheck attendance before each sample; never collect outside an active workday.
    const status=await apiFetch<{active:boolean}>('/api/field/location/status');
    if(!status.active||!allowed())return;
    let position:{coords:{latitude:number;longitude:number;accuracy:number};timestamp:number};
    if(Capacitor.isNativePlatform()){
     const permission=await Geolocation.requestPermissions();
     if(permission.location!=='granted'&&permission.coarseLocation!=='granted')throw new Error('Location permission is required to share your position.');
     if(!allowed())return;
     position=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:15000,maximumAge:0});
    }else{
     if(!navigator.geolocation)throw new Error('Location is not supported on this device.');
     position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
    }
    if(!allowed())return;
    await apiFetch('/api/field/location',{method:'POST',body:JSON.stringify({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy_m:position.coords.accuracy,captured_at:new Date(position.timestamp).toISOString()})});
    if(alive)setError('');
   }catch(e){if(alive)setError(e instanceof Error?e.message:'Location sharing unavailable.');}
   finally{busy=false;}
  }
  if(enabled&&foreground&&work.data?.active){void sample();}
  const timer=window.setInterval(()=>void sample(),45000);
  return()=>{alive=false;clearInterval(timer);void apiFetch('/api/field/location/pause',{method:'POST'}).catch(()=>{});};
 },[enabled,foreground,work.data?.active,managerId]);
 return <section style={{margin:'12px 16px',padding:14,border:'1px solid #dce6f2',borderRadius:12,background:'#f5f9ff'}} aria-label={uiText('Workday location sharing')}><strong>{uiText('Workday location sharing')}</strong><p style={{fontSize:12,lineHeight:1.6}}>{uiText('Admin can see your latest GPS position and accuracy. Updates run only while this app is visible and today’s attendance is active. No background tracking or route history.')}</p><button className="button secondary" onClick={()=>{const next=!enabled;localStorage.setItem(key,String(next));setEnabled(next);setError('');}}>{uiText(enabled?'Pause location sharing':'Enable location sharing')}</button><p style={{fontSize:12}}>{uiText(!enabled?'Location sharing paused':work.data?.active&&foreground?'Foreground updates enabled':'Waiting for an active workday')}</p>{(error||work.isError)&&<p role="alert">{error||uiText('Workday status unavailable. Location updates are paused.')}</p>}</section>;
}
