import {needsAppUpdate} from '../appUpdatePolicy';
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {App as NativeApp} from '@capacitor/app';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {useTranslation} from 'react-i18next';
import {apiFetch} from '../api';
import {uiText} from '../uiText';
import './required-app-update.css';
type Policy={enabled:boolean;minimumBuild:number};
const updateLauncher=registerPlugin<{openStore:()=>Promise<void>}>('AEAppUpdate');
export function RequiredAppUpdate({children}:{children:ReactNode}){
 useTranslation(undefined,{bindI18n:'languageChanged loaded'});
 const native=Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
 const [checking,setChecking]=useState(native),[blocked,setBlocked]=useState(false),[error,setError]=useState('');
 const check=useCallback(async()=>{if(!native)return;setError('');const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),8000);try{const [info,result]=await Promise.all([NativeApp.getInfo(),apiFetch<{policy:Policy}>('/api/app-update-policy',{signal:controller.signal,cache:'no-store'})]);setBlocked(needsAppUpdate(Number(info.build),result.policy));}catch{setError('Unable to check for updates. Check your connection and try again.');}finally{window.clearTimeout(timeout);setChecking(false);}},[native]);
 useEffect(()=>{if(!native)return;void check();let disposed=false;let listener:{remove:()=>Promise<void>}|undefined;void NativeApp.addListener('appStateChange',state=>{if(state.isActive)void check();}).then(value=>{if(disposed)void value.remove();else listener=value;});return()=>{disposed=true;void listener?.remove();};},[native,check]);
 async function openStore(){setError('');try{await updateLauncher.openStore();}catch{setError('Unable to open Google Play. Please try again.');}}
 if(!native)return <>{children}</>;
 if(checking)return <main className="ae-required-update" role="status"><img src="/logo.png" alt="AE"/><p>{uiText('Checking for app updates…')}</p></main>;
 if(!blocked)return <>{children}</>;
 return <main className="ae-required-update"><section aria-labelledby="ae-update-title"><img src="/logo.png" alt="AE"/><h1 id="ae-update-title">{uiText('Please update AE to continue')}</h1><p>{uiText('A newer version of AE is required. Update from Google Play, then return to the app.')}</p><button className="button primary" type="button" onClick={()=>void openStore()}>{uiText('Update now')}</button><button className="button secondary" type="button" onClick={()=>void check()}>{uiText('Check again')}</button>{error&&<p role="alert">{uiText(error)}</p>}</section></main>;
}
