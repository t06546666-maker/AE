import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { apiFetch } from './api';
import type { UserProfile } from './types';

export function useUsageTracking(user:UserProfile|null) {
 useEffect(()=>{
  if(!user)return;
  let busy=false;
  const platform=Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android'?'android':'web';
  let installationId:string|undefined;
  if(platform==='android') {
   try {installationId=localStorage.getItem('ae-installation-id')||crypto.randomUUID();localStorage.setItem('ae-installation-id',installationId);}catch { /* Activity can still be tracked if storage is unavailable. */ }
  }
  const report=async()=>{
   if(document.hidden||busy)return;busy=true;
   try {await apiFetch(user.role==='customer'?'/api/customer/usage':'/api/usage',{method:'POST',body:JSON.stringify({platform,installationId})});}catch { /* Analytics must not interrupt app use. */ }finally{busy=false;}
  };
  void report();const timer=window.setInterval(()=>void report(),120000);
  const visible=()=>{if(!document.hidden)void report()};document.addEventListener('visibilitychange',visible);
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',visible)};
 },[user?.id,user?.role]);
}
