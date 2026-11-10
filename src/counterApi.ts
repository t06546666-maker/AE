import {Capacitor} from '@capacitor/core';
const key='ae_counter_staff_token';
export const counterToken=()=>localStorage.getItem(key)||'';
export const setCounterToken=(token:string)=>token?localStorage.setItem(key,token):localStorage.removeItem(key);
export async function counterApi<T>(path:string,init:RequestInit={}):Promise<T>{
 const headers=new Headers(init.headers);if(counterToken())headers.set('Authorization','Bearer '+counterToken());if(init.body)headers.set('Content-Type','application/json');
 const base=Capacitor.isNativePlatform()?(import.meta.env.VITE_AE_ENV==='staging'?import.meta.env.VITE_API_URL:'https://www.affiliateae.co.in'):window.location.hostname.endsWith('affiliateae.co.in')?'':import.meta.env.VITE_API_URL||'';
 const result=await fetch(base+path,{...init,headers});const data=await result.json();if(!result.ok){if(result.status===401){setCounterToken('');window.dispatchEvent(new Event('ae:counter-unauthorized'));}throw Object.assign(Error(data.error||'Request failed.'),{code:data.code,status:result.status});}return data;
}
