import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch,queryString } from '../api';
import { rangeForChartPeriod } from '../utils';
import { uiText } from '../uiText';
import { ErrorState,LoadingState } from './Common';
type Counts={activeUsers:number;activeCustomers:number;activeMerchants:number;websiteUsers:number;androidUsers:number};
type Usage=Counts&{recentlyActive:Counts;trackedAndroidInstallations:number;trackedSince:string|null};
export function AdminUsage() {
 const [period,setPeriod]=useState<'today'|'week'|'month'>('today');const range=rangeForChartPeriod(period)!;
 const data=useQuery({queryKey:['admin-usage',range.from,range.to],queryFn:({signal})=>apiFetch<Usage>(`/api/admin/usage?${queryString(range)}`,{signal}),refetchInterval:60000});
 return <section className="admin-card" style={{margin:'22px 0'}}><div className="admin-card-title"><div><h2>{uiText('App & website usage')}</h2><p>{uiText('Unique signed-in accounts across both platforms')}</p></div><select aria-label={uiText('Usage period')} value={period} onChange={event=>setPeriod(event.target.value as typeof period)}>{[['today','Today'],['week','This Week'],['month','This Month']].map(([value,label])=><option value={value} key={value}>{uiText(label)}</option>)}</select></div>{data.isPending?<LoadingState/>:data.isError?<ErrorState error={data.error} retry={()=>void data.refetch()}/>:data.data&&<><div className="admin-snapshot" style={{gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))'}}>{[['Active users',data.data.activeUsers],['Active customers',data.data.activeCustomers],['Active merchants',data.data.activeMerchants],['Website users',data.data.websiteUsers],['Android app users',data.data.androidUsers],['Recently active (5 minutes)',data.data.recentlyActive.activeUsers],['Recently active merchants',data.data.recentlyActive.activeMerchants],['Tracked Android installations',data.data.trackedAndroidInstallations]].map(([label,value])=><div key={label}><strong>{Number(value).toLocaleString('en-IN')}</strong><span>{uiText(String(label))}</span></div>)}</div><p>{uiText('Installations are counted after first sign-in on Android. Reinstalling or clearing app data may count as a new installation. Website visits are not installations.')}</p><p>{uiText('Recently active means a foreground session seen within 5 minutes, not guaranteed online right now.')}</p><p>{uiText('Tracking starts with this update; previous usage is not estimated.')}</p></>}</section>;
}
