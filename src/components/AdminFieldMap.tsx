import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import { formatDateTime } from '../utils';
import { loadGoogleMaps } from './CustomerNearbyMap';
import { ErrorState, LoadingState } from './Common';
type Pin={manager_id:string;name:string;latitude:number;longitude:number;accuracy_m:number;captured_at:string;updated_at:string;recent:boolean};
export function AdminFieldMap(){
 const q=useQuery({queryKey:['admin-field-manager-locations'],queryFn:({signal})=>apiFetch<{records:Pin[]}>('/api/admin/field-manager-locations',{signal}),refetchInterval:30000});
 const host=useRef<HTMLDivElement>(null),map=useRef<any>(null);const [ready,setReady]=useState(false),[error,setError]=useState('');const fitted=useRef(false);
 useEffect(()=>{let alive=true;loadGoogleMaps().then(google=>{if(!alive||!host.current)return;map.current=new google.maps.Map(host.current,{center:{lat:10.7,lng:76.7},zoom:11,streetViewControl:false,mapTypeControl:false});setReady(true);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;map.current=null;};},[]);
 useEffect(()=>{
  if(!ready||!map.current||!q.data)return;
  const google=(window as any).google;
  const pins=q.data.records.filter(pin=>Number.isFinite(pin.latitude)&&Number.isFinite(pin.longitude));
  const bounds=new google.maps.LatLngBounds();
  const markers=pins.map(pin=>{
   const recent=pin.recent&&Date.now()-Date.parse(pin.captured_at)<=120000;
   const position={lat:pin.latitude,lng:pin.longitude};bounds.extend(position);
   const marker=new google.maps.Marker({map:map.current,position,title:`${pin.name} · ${uiText(recent?'Recent update':'Last seen')}`,label:{text:pin.name,color:'#18233e',fontSize:'12px'},icon:{path:google.maps.SymbolPath.CIRCLE,scale:9,fillColor:recent?'#1379ef':'#8794a9',fillOpacity:1,strokeColor:'#fff',strokeWeight:2}});
   const content=document.createElement('div');const heading=document.createElement('strong');heading.textContent=pin.name;content.append(heading);
   const info=document.createElement('p');info.textContent=`${uiText(recent?'Recent update':'Last seen')} · ${formatDateTime(pin.captured_at)} · ±${Math.round(pin.accuracy_m)} m`;content.append(info);
   const popup=new google.maps.InfoWindow({content});marker.addListener('click',()=>popup.open({map:map.current,anchor:marker}));return {marker,popup};
  });
  if(pins.length&&!fitted.current){map.current.fitBounds(bounds);if(pins.length===1)map.current.setZoom(14);fitted.current=true;}
  return()=>markers.forEach(({marker,popup})=>{popup.close();google.maps.event.clearInstanceListeners(marker);marker.setMap(null);});
 },[ready,q.data]);
 return <section className="panel"><div className="panel-heading"><h2>{uiText('Field manager locations')}</h2><button className="button secondary" onClick={()=>void q.refetch()}>{uiText('Refresh')}</button></div><p className="admin-directory-note">{uiText('Latest shared positions, not guaranteed live. Blue means a recent workday update; grey means last seen. Attendance check-in locations are not substituted for current positions.')}</p><div ref={host} style={{height:360,borderRadius:14,border:'1px solid #e2e9f3'}} aria-label={uiText('Field manager location map')}/>{error&&<p role="alert">{error}</p>}{q.isPending?<LoadingState/>:q.isError?<ErrorState error={q.error} retry={()=>void q.refetch()}/>:<>{!q.data.records.length&&<p>{uiText('No field managers have shared a workday location yet.')}</p>}<div className="admin-linked-shops" style={{marginTop:14}}>{q.data.records.map(pin=><Link to={`/field-managers/${pin.manager_id}`} key={pin.manager_id}><span><strong>{pin.name}</strong><small>{uiText(pin.recent&&Date.now()-Date.parse(pin.captured_at)<=120000?'Recent update':'Last seen')} · {formatDateTime(pin.captured_at)}</small><small>{uiText('GPS accuracy')}: ±{Math.round(pin.accuracy_m)} m</small></span></Link>)}</div></>}</section>;
}
