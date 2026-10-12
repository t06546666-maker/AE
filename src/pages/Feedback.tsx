import { useState } from 'react';
import { uiText } from '../uiText';
import { formatDateTime } from '../utils';
import { MessageSquare, Star, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from '../components/Common';
import type { UserProfile } from '../types';
import '../feedback.css';
type FeedbackItem={id:string;type:'app'|'merchant';rating:number|null;message:string;createdAt:string;customerName:string;merchantName:string};
type MerchantFeedback={id:string;category:string;rating:number|null;message:string;createdAt:string;merchantName:string};
type Tab='merchants'|'app'|'reviews';
export function Feedback({user}:{user:UserProfile}){
 const admin=user.role==='admin';const [tab,setTab]=useState<Tab>(admin?'merchants':'reviews');
 const merchants=useQuery({queryKey:['merchant-feedback',user.id],enabled:admin,queryFn:({signal})=>apiFetch<{feedback:MerchantFeedback[]}>('/api/admin/merchant-feedback',{signal,cache:'no-store'})});
 const customers=useQuery({queryKey:['feedback',user.id,user.role,user.merchant_id],queryFn:({signal})=>apiFetch<{feedback:FeedbackItem[]}>('/api/feedback',{signal,cache:'no-store'})});
 const active=admin&&tab==='merchants'?merchants:customers;
 const tabs:Array<[Tab,string]>=[['merchants','Merchant feedback'],['app','Customer app feedback'],['reviews','Store reviews']];
 const cards=admin&&tab==='merchants'?merchants.data?.feedback.map(item=>({id:item.id,name:item.merchantName,category:item.category,rating:item.rating,message:item.message,date:item.createdAt,store:''})):customers.data?.feedback.filter(item=>item.type===(tab==='app'?'app':'merchant')).map(item=>({id:item.id,name:admin?item.customerName:uiText('Anonymous'),category:uiText(item.type==='app'?'App feedback':'Store review'),rating:item.rating,message:item.message,date:item.createdAt,store:item.merchantName}));
 return <div className="ae-feedback-page"><header className="ae-feedback-heading"><div><h1>{uiText(admin?'Feedback & Reviews':'Customer Reviews & Feedback')}</h1><p>{uiText(admin?'App feedback and merchant reviews':'Anonymous customer reviews about your store')}</p></div><button type="button" className="button secondary" disabled={active.isFetching} onClick={()=>void active.refetch()}><RefreshCw size={16}/>{uiText(active.isFetching?'Refreshing…':'Refresh')}</button></header>
 {admin&&<div className="ae-feedback-tabs" role="tablist" aria-label={uiText('Feedback types')}>{tabs.map(([key,label])=><button type="button" role="tab" id={`feedback-tab-${key}`} aria-controls="feedback-content" aria-selected={tab===key} key={key} onClick={()=>setTab(key)}>{uiText(label)}</button>)}</div>}
 <section id="feedback-content" role={admin?'tabpanel':undefined} aria-labelledby={admin?`feedback-tab-${tab}`:undefined} className="ae-feedback-content" aria-busy={active.isFetching}>{active.isPending?<LoadingState/>:active.isError?<ErrorState error={active.error} retry={()=>void active.refetch()}/>:!cards?.length?<div className="ae-feedback-empty"><MessageSquare size={30}/><h2>{uiText('No feedback yet')}</h2><p>{uiText('Feedback will appear here when it is submitted.')}</p></div>:cards.map(item=><article className="ae-feedback-card" key={item.id}><span className="ae-feedback-avatar" aria-hidden="true">{Array.from(item.name||'?')[0]?.toLocaleUpperCase()}</span><div className="ae-feedback-body"><div className="ae-feedback-card-heading"><strong>{item.name}</strong><span className="ae-feedback-category">{uiText(item.category)}</span></div><div className="ae-feedback-meta">{item.rating!=null&&<span className="ae-feedback-rating" aria-label={`${item.rating} ${uiText('out of 5')}`}><Star size={15} fill="currentColor"/>{item.rating}/5</span>}<time dateTime={item.date}>{formatDateTime(item.date)}</time>{admin&&item.store&&tab==='reviews'&&<span>{item.store}</span>}</div><p className="ae-feedback-message">{item.message}</p></div></article>)}</section>
 {!active.isError&&(admin&&tab==='merchants'?merchants.data?.feedback.length:customers.data?.feedback.length)===200&&<p className="ae-feedback-limit">{uiText('Showing up to 200 recent records from this feedback source.')}</p>}</div>;
}
