import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, queryString } from '../api';
import { LoadingState, ErrorState, PaginationBar } from './Common';
import type { Pagination } from '../types';
import { uiText } from '../uiText';
export function AdminFieldHistory({id}:{id:string}){
 const [type,setType]=useState('visits'),[page,setPage]=useState(1);
 const q=useQuery({queryKey:['admin-field-history',id,type,page],queryFn:({signal})=>apiFetch<{records:Record<string,any>[];pagination:Pagination}>(`/api/admin/field-managers/${id}/records?${queryString({type,page,pageSize:25})}`,{signal})});
 function detail(value:any):any {if(value==null)return '—';if(Array.isArray(value))return value.map((item,index)=><div key={index}>{detail(item)}</div>);if(typeof value==='object')return <dl>{Object.entries(value).map(([key,item])=><div key={key}><dt>{uiText(key.replaceAll('_',' '))}</dt><dd>{detail(item)}</dd></div>)}</dl>;if(typeof value==='string'&&/^https:\/\//.test(value))return <a href={value} target="_blank" rel="noopener noreferrer">{uiText('Open attachment')}</a>;return String(value);}
 return <section className="panel"><h2>{uiText('Complete field manager history')}</h2><p>{uiText('Browse all recorded history with pagination. Missing record categories show an error, not invented data.')}</p><nav className="form-actions">{[['visits','Visits'],['attendance','Attendance'],['updates','Onboarding & Updates'],['sessions','Login / logout'],['activity','Activity'],['requests','Work Requests']].map(([key,label])=><button key={key} className={`button ${key===type?'primary':'secondary'}`} onClick={()=>{setType(key);setPage(1)}}>{uiText(label)}</button>)}</nav>{q.isPending?<LoadingState/>:q.isError?<ErrorState error={q.error} retry={()=>void q.refetch()}/>:<><p>{q.data.pagination.total} {uiText('records')}</p>{q.data.records.map(row=><details className="panel" key={row.id}><summary>{row.merchants?.name || row.work_date || row.kind || row.action || uiText('Record')} · {row.check_in_at || row.login_at || row.created_at || row.starts_at || ''}</summary><div style={{overflowWrap:'anywhere'}}>{detail(row)}</div></details>)}{!q.data.records.length&&<p>{uiText('No records.')}</p>}<PaginationBar pagination={q.data.pagination} onPage={setPage}/></>}</section>;
}
