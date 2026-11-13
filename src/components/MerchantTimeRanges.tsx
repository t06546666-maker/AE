import {useState} from 'react';
import {useQuery,useMutation} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {apiFetch} from '../api';
export type TimeRange={start:string;end:string};
export type TradingTimes={peak_hours:TimeRange[];low_hours:TimeRange[]};
export const emptyTradingTimes=():TradingTimes=>({peak_hours:[],low_hours:[]});
export function MerchantTimeRanges({value,onChange,readOnly=false}:{value:TradingTimes;onChange?:(value:TradingTimes)=>void;readOnly?:boolean}){
 const {i18n}=useTranslation(),ml=i18n.language.startsWith('ml');
 return <fieldset style={{minWidth:0,border:'1px solid var(--border)',borderRadius:12,padding:14}}><legend>{ml?'കടയിലെ തിരക്കുള്ളതും തിരക്ക് കുറഞ്ഞതുമായ സമയങ്ങൾ':'Shop busy and quiet hours'}</legend>{(['peak_hours','low_hours'] as const).map(key=><div key={key} style={{marginBottom:16}}><h3>{key==='peak_hours'?(ml?'തിരക്കുള്ള സമയം':'Peak Hours'):(ml?'തിരക്ക് കുറഞ്ഞ സമയം':'Low Hours')}</h3>{!value[key].length&&<p>{ml?'സമയങ്ങൾ ചേർത്തിട്ടില്ല':'No time ranges added'}</p>}{value[key].map((range,index)=><div key={index} style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'end',marginBottom:10}}>{(['start','end'] as const).map(part=><label key={part} style={{flex:'1 1 100px',minWidth:0}}>{part==='start'?(ml?'ആരംഭ സമയം':'Start time'):(ml?'അവസാന സമയം':'End time')}<input type="time" required={!readOnly} disabled={readOnly} value={range[part]} style={{width:'100%',minWidth:0}} onChange={e=>onChange?.({...value,[key]:value[key].map((item,i)=>i===index?{...item,[part]:e.target.value}:item)})}/></label>)}{!readOnly&&<button type="button" className="button secondary" aria-label={`Remove ${key} range ${index+1}`} onClick={()=>onChange?.({...value,[key]:value[key].filter((_,i)=>i!==index)})}>{ml?'നീക്കുക':'Remove'}</button>}</div>)}{!readOnly&&<button type="button" className="button secondary" onClick={()=>onChange?.({...value,[key]:[...value[key],{start:'',end:''}]})}>{ml?'+ സമയം ചേർക്കുക':'+ Add time range'}</button>}</div>)}<small>{ml?'അർദ്ധരാത്രി കഴിഞ്ഞ് അവസാനിക്കുന്ന സമയങ്ങളും ചേർക്കാം.':'Ranges may end after midnight. Times use the shop’s local time.'}</small></fieldset>;
}
export function MerchantTradingTimes({merchantId,role}:{merchantId:string;role:'admin'|'field'|'merchant'}){
 const [draft,setDraft]=useState<TradingTimes|null>(null);
 const query=useQuery({queryKey:['merchant-trading-times',merchantId],queryFn:()=>apiFetch<TradingTimes>(`/api/merchant-trading-times/${encodeURIComponent(merchantId)}`)});
 const save=useMutation({mutationFn:()=>apiFetch(`/api/merchant-trading-times/${encodeURIComponent(merchantId)}`,{method:'PUT',body:JSON.stringify(draft)}),onSuccess:()=>{setDraft(null);void query.refetch();}});
 return <section className="panel">{query.isPending?<p>Loading shop hours…</p>:query.isError?<p role="alert">{query.error.message}</p>:<><MerchantTimeRanges value={draft||query.data} onChange={setDraft} readOnly={role==='merchant'}/>{role!=='merchant'&&<button type="button" className="button primary" disabled={!draft||save.isPending||Object.values(draft).flat().some(r=>!r.start||!r.end||r.start===r.end)} onClick={()=>save.mutate()}>Save time ranges</button>}{save.isSuccess&&<p role="status">Time ranges saved.</p>}{save.isError&&<p role="alert">{save.error.message}</p>}</>}</section>;
}
