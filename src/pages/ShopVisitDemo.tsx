import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ShopVisitTracking} from '../components/ShopVisitTracking';
export default function ShopVisitDemo(){
 const [admin,setAdmin]=useState(false);const {i18n}=useTranslation();
 return <div style={{background:'#f1f6fd',minHeight:'100dvh',padding:16}}><header style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',padding:16,background:'white',borderRadius:16,marginBottom:14}}><img src="/logo.png" alt="AE" width={64}/><strong>{admin?'Admin demo':'Field Manager demo'}</strong><span style={{flex:1}}>Sample shops only. Nothing here is saved to the live database.</span><button className="button secondary" onClick={()=>setAdmin(!admin)}>{admin?'Show Field Manager':'Show Admin'}</button><button className="button secondary" onClick={()=>void i18n.changeLanguage(i18n.language.startsWith('ml')?'en':'ml')}>English / മലയാളം</button></header><ShopVisitTracking key={String(admin)} admin={admin} demo/></div>;
}
