import { useEffect,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { apiFetch,queryString } from '../api';
import { uiText } from '../uiText';
import { formatCurrency } from '../utils';
import { indiaDate } from '../pages/merchantAnalytics';
import { ErrorState,LoadingState } from './Common';

type Target={month:string;label:string;startDate:string;endDate:string;from:string;to:string;target:number|null;sales:number;remaining:number|null;percent:number;achieved:boolean};
export function SalesTarget({merchantId,month}:{merchantId:string|null;month:string}) {
 const client=useQueryClient();const [editing,setEditing]=useState(false),[amount,setAmount]=useState('');
 const [period,setPeriod]=useState<'day'|'week'|'month'|'custom'>('month');
 const today=indiaDate(new Date());const [from,setFrom]=useState(today),[to,setTo]=useState(today);
 const selection={period,month,from,to};
 const key=['sales-target',merchantId,month,period,from,to];
 const datesValid=period!=='custom'||(!!from&&!!to&&from<=to);
 const data=useQuery({queryKey:key,queryFn:({signal})=>apiFetch<Target>(`/api/merchant/sales-target?${queryString(selection)}`,{signal}),enabled:!!merchantId&&datesValid,refetchInterval:15000});
 useEffect(()=>{setEditing(false)},[month]);
 const save=useMutation({mutationFn:()=>apiFetch('/api/merchant/sales-target',{method:'PUT',body:JSON.stringify({...selection,amount:Number(amount)})}),onSuccess:()=>{setEditing(false);void client.invalidateQueries({queryKey:['sales-target',merchantId]});}});
 const canEdit=!!data.data&&Date.parse(data.data.to)>Date.now()&&datesValid;
 return <section className="mo-panel" style={{marginBottom:20}}><div className="mo-panel-heading"><div><h2>{uiText('Sales Target')}</h2><p>{data.data?.label || month} · {uiText('Recorded AE sales only')}</p></div><select aria-label={uiText('Target period')} value={period} onChange={event=>{setPeriod(event.target.value as typeof period);setEditing(false)}}>{[['day','Daily'],['week','Weekly'],['month','Monthly'],['custom','Custom dates']].map(([value,label])=><option key={value} value={value}>{uiText(label)}</option>)}</select>{canEdit&&<button className="button secondary" type="button" onClick={()=>{setAmount(String(data.data?.target || ''));setEditing(true)}}>{uiText(data.data?.target?'Edit target':'Set target')}</button>}</div>
 {period!=='month'&&<div className="two-column-form"><label>{uiText(period==='custom'?'Start date':period==='week'?'Choose a date in the week':'Target date')}<input type="date" value={from} onChange={event=>{if(event.target.value){setFrom(event.target.value);setEditing(false)}}}/></label>{period==='custom'&&<label>{uiText('End date')}<input type="date" min={from} value={to} onChange={event=>{if(event.target.value){setTo(event.target.value);setEditing(false)}}}/></label>}</div>}
 {!datesValid&&<p className="form-error" role="alert">{uiText('End date must be on or after start date.')}</p>}
 {editing&&<form onSubmit={event=>{event.preventDefault();save.mutate()}}><label>{uiText('Sales target (₹)')}<input type="number" min="1" max="100000000" step="0.01" required value={amount} onChange={event=>setAmount(event.target.value)} /></label>{save.isError&&<p className="form-error" role="alert">{uiText(save.error.message)}</p>}<div className="form-actions"><button type="submit" className="button primary" disabled={save.isPending}>{uiText(save.isPending?'Saving…':'Save target')}</button><button type="button" className="button secondary" onClick={()=>setEditing(false)}>{uiText('Cancel')}</button></div></form>}
 {!datesValid?null:data.isPending?<LoadingState/>:data.isError?<ErrorState error={data.error} retry={()=>void data.refetch()}/>:data.data&&<><div className="mo-columns"><div><p>{uiText('Target amount')}</p><h2>{data.data.target===null?'—':formatCurrency(data.data.target)}</h2></div><div><p>{uiText('Sales achieved')}</p><h2>{formatCurrency(data.data.sales)}</h2></div></div>{data.data.target!==null?<><div style={{display:'flex',justifyContent:'space-between',gap:12}}><span>{uiText('Target achieved')}</span><strong>{Math.floor(data.data.percent)}%</strong></div><div role="progressbar" aria-label={uiText('Target achieved')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(data.data.percent)} className="mo-progress" style={{margin:'12px 0'}}><span style={{display:'block',height:12,width:`${data.data.percent}%`,background:'#16a078',borderRadius:8}}/></div><p role="status">{data.data.achieved?uiText('Congratulations! Your sales target has been achieved.'): `${formatCurrency(data.data.remaining || 0)} ${uiText('left to reach your target.')}`}</p></>:<p>{uiText('No sales target set for this period.')}</p>}</>}
 </section>;
}
