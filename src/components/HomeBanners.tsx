import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {apiFetch} from '../api';
import {uiText} from '../uiText';
import {CustomerOfferPreviewModal,type PreviewOfferData} from './CustomerOfferPreviewModal';
type Banner={id:string;title:string;titleMl?:string;subtitle?:string;subtitleMl?:string;imageUrl:string;offerImageUrl?:string;merchantName?:string;merchantPhone?:string;merchantAddress?:string;category?:string;expiresAt?:string};
export function HomeBanners({onImageChange,bannerIds}:{onImageChange?:(url:string)=>void;bannerIds?:string[]}){
 const {i18n}=useTranslation(undefined,{bindI18n:'languageChanged loaded'}),[index,setIndex]=useState(0),[paused,setPaused]=useState(false),[preview,setPreview]=useState<PreviewOfferData|null>(null);
 const query=useQuery({queryKey:['customer','home-banners'],queryFn:({signal})=>apiFetch<{banners:Banner[]}>('/api/customer/banners',{signal}),staleTime:30000,refetchInterval:60000});
 const available=query.data?.banners||[],banners=bannerIds?bannerIds.flatMap(id=>{const banner=available.find(row=>row.id===id);return banner?[banner]:[];}):available,count=banners.length,current=banners[index]||banners[0],ml=i18n.language.startsWith('ml');
 useEffect(()=>{onImageChange?.(current?.imageUrl||'');},[current?.imageUrl,onImageChange]);
 useEffect(()=>{if(index>=count)setIndex(0);},[index,count]);
 useEffect(()=>{if(count<2||paused||preview)return;const timer=window.setInterval(()=>{if(!document.hidden)setIndex(value=>(value+1)%count);},6000);return()=>window.clearInterval(timer);},[count,paused,preview]);
 if(query.isPending)return <p role="status">{uiText('Loading banners…')}</p>;
 if(query.isError&&!current)return <p>{uiText('Banners are unavailable.')} <button type="button" onClick={()=>void query.refetch()}>{uiText('Retry')}</button></p>;
 if(!current)return null;
 const title=ml?(current.titleMl||current.title):current.title,subtitle=ml?(current.subtitleMl||current.subtitle):current.subtitle;
 return <section aria-label={uiText('Home banners')} aria-roledescription="carousel" className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}}>
 <button type="button" className="block w-full text-left" onClick={()=>setPreview({id:current.id,title,description:subtitle||'',imageUrl:current.offerImageUrl||current.imageUrl,merchantName:current.merchantName,merchantPhone:current.merchantPhone,merchantAddress:current.merchantAddress,category:current.category,expiresAt:current.expiresAt})}>
 <div key={current.id} style={{position:'relative',width:'100%',aspectRatio:'16 / 9',overflow:'hidden',background:'#edf3fa',isolation:'isolate'}}><img src={current.imageUrl} alt="" aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',filter:'blur(20px) brightness(.75)',transform:'scale(1.15)',zIndex:-1}}/><img src={current.imageUrl} alt={title} style={{display:'block',width:'100%',height:'100%',objectFit:'contain',objectPosition:'center',transition:'opacity 260ms ease'}}/><div style={{position:'absolute',inset:'auto 0 0',padding:'28px 16px 14px',background:'linear-gradient(transparent,rgba(4,14,38,.84))',color:'#fff'}}><h3 className="font-bold leading-relaxed">{title}</h3>{subtitle&&<p className="text-xs leading-relaxed text-white/90">{subtitle}</p>}</div></div></button>
 {count>1&&<div className="ae-banner-line-controls"><button type="button" aria-label={uiText('Previous banner')} onClick={()=>setIndex(value=>(value-1+count)%count)}><ChevronLeft size={16}/></button><input aria-label={uiText('Choose banner')} type="range" min={0} max={count-1} value={index} onChange={event=>setIndex(Number(event.target.value))}/><button type="button" aria-label={uiText('Next banner')} onClick={()=>setIndex(value=>(value+1)%count)}><ChevronRight size={16}/></button></div>}
 <CustomerOfferPreviewModal offer={preview} onClose={()=>setPreview(null)}/></section>;
}
