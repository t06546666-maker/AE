import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { LoadingState, ErrorState, PaginationBar } from './Common';
import { AdminForceCloseVisit } from './AdminForceCloseVisit';
import type { Pagination } from '../types';
import { formatDateTime } from '../utils';
import { uiText } from '../uiText';
type Row=Record<string,any>&{id:string;status:string;check_in_at:string};
const tabs=[['visits','Visits'],['attendance','Attendance'],['updates','Onboarding & Updates'],['sessions','Login / logout'],['activity','Activity'],['requests','Work Requests']];
const fields:Record<string,string[]>={visits:['merchants','check_in_at','check_out_at','challenge_status','status'],attendance:['work_date','started_at','ended_at','accuracy_m'],updates:['merchant_id','status','created_at'],sessions:['login_at','logout_at'],activity:['merchants','action','created_at'],requests:['kind','starts_at','ends_at','status']};
const labels:Record<string,string>={merchants:'Merchant',merchant_id:'Merchant',check_in_at:'Check-in',check_out_at:'Check-out',challenge_status:'Challenge status',status:'Status',work_date:'Date',started_at:'Started',ended_at:'Ended',accuracy_m:'GPS accuracy',login_at:'Login',logout_at:'Logout',created_at:'Submitted',action:'Action',kind:'Request type',starts_at:'Start',ends_at:'End',notes:'Notes',reason:'Reason',outcome:'Outcome',follow_up_date:'Follow-up date',feedback:'Merchant feedback',problems:'Problems',admin_close_reason:'Admin close reason',payload:'Submitted details',photos:'Photos',selfie:'Attendance photo',report_image:'Visit photo'};
function display(value:any,key=''):any{
 if(value==null||value==='')return '—';
 if(Array.isArray(value))return value.map((item,index)=><div key={index}>{display(item,key)}</div>);
 if(typeof value==='object')return <dl className="admin-field-detail-grid">{Object.entries(value).map(([name,item])=><div key={name}><dt>{uiText(labels[name]||name.replaceAll('_',' '))}</dt><dd>{display(item,name)}</dd></div>)}</dl>;
 if(typeof value==='string'&&/^https:\/\//.test(value))return <a href={value} target="_blank" rel="noopener noreferrer">{uiText('Open attachment')}</a>;
 if(key.endsWith('_at'))return formatDateTime(String(value));
 return String(value);
}
export function AdminFieldHistory({id}:{id:string}){
 const [type,setType]=useState('visits'),[page,setPage]=useState(1);
 useEffect(()=>{setType('visits');setPage(1);},[id]);
 const q=useQuery({queryKey:['admin-field-history',id,type,page],queryFn:({signal})=>apiFetch<{records:Row[];pagination:Pagination}>(`/api/admin/field-managers/${encodeURIComponent(id)}/records?${queryString({type,page,pageSize:25})}`,{signal})});
 return <><nav className="admin-detail-tabs" aria-label={uiText('Manager records')}>{tabs.map(([key,label])=><button key={key} aria-pressed={key===type} onClick={()=>{setType(key);setPage(1)}}>{uiText(label)}</button>)}</nav><section className="panel"><div className="panel-heading"><h2>{uiText(tabs.find(([key])=>key===type)![1])}</h2>{q.data&&<span className="admin-source-badge">{q.data.pagination.total} {uiText('records')}</span>}</div>{q.isPending?<LoadingState/>:q.isError?<ErrorState error={q.error} retry={()=>void q.refetch()}/>:<>{type==='visits'&&<AdminForceCloseVisit visits={q.data.records}/>}<div className="table-scroll"><table><thead><tr>{fields[type].map(key=><th key={key}>{uiText(labels[key]||key)}</th>)}<th>{uiText('Details')}</th></tr></thead><tbody>{q.data.records.map(row=><tr key={row.id}>{fields[type].map(key=><td key={key}>{key==='merchants'?<Link to={`/merchants/${row.merchant_id}`}>{row.merchants?.name || row.merchant_id}</Link>:key==='merchant_id'?<Link to={`/merchants/${row.merchant_id}`}>{row.payload?.merchant_name || row.payload?.name || row.merchant_id}</Link>:display(row[key],key)}</td>)}<td><details className="admin-field-record-details"><summary>{uiText('View details')}</summary><div className="admin-field-expanded"><h3>{uiText('Record details')}</h3>{display(Object.fromEntries(Object.entries(row).filter(([key])=>!['id','merchants','merchant_id'].includes(key))))}{row.check_in_latitude!=null&&row.check_in_longitude!=null&&<a className="button secondary" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${Number(row.check_in_latitude)},${Number(row.check_in_longitude)}`}>{uiText('View recorded location')}</a>}{row.latitude!=null&&row.longitude!=null&&<a className="button secondary" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${Number(row.latitude)},${Number(row.longitude)}`}>{uiText('View recorded location')}</a>}</div></details></td></tr>)}</tbody></table></div>{!q.data.records.length&&<p>{uiText('No records.')}</p>}<PaginationBar pagination={q.data.pagination} onPage={setPage}/></>}</section></>;
}
