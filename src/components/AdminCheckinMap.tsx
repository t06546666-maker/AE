import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import { formatDateTime } from '../utils';
import { loadGoogleMaps } from './CustomerNearbyMap';

type Pin = {id:string;kind:'attendance'|'attendance_end'|'visit';at:string;latitude:number;longitude:number;accuracy_m:number|null;name:string|null;number:number};
export function AdminCheckinMap({managerId}:{managerId:string}) {
  const [day,setDay]=useState(()=>new Date(Date.now()+330*60000).toISOString().slice(0,10));
  const [ready,setReady]=useState(false),[mapError,setMapError]=useState('');
  const host=useRef<HTMLDivElement>(null),map=useRef<any>(null),markers=useRef<Map<string,{marker:any;popup:any}>>(new Map());
  const q=useQuery({queryKey:['admin-check-in-map',managerId,day],enabled:Boolean(day),queryFn:({signal})=>apiFetch<{pins:Pin[];missingLocations:number}>(`/api/admin/field-managers/${encodeURIComponent(managerId)}/check-in-map?day=${encodeURIComponent(day)}`,{signal})});
  const label=(pin:Pin)=>pin.kind==='attendance'?uiText('Workday started'):pin.kind==='attendance_end'?uiText('Workday ended'):pin.name || uiText('Visit check-in');
  const detail=(pin:Pin)=>`${formatDateTime(pin.at)}${pin.accuracy_m==null?'':` · ${uiText('GPS accuracy')}: ±${Math.ceil(pin.accuracy_m)} m`}`;
  useEffect(()=>{
    let alive=true;
    loadGoogleMaps().then(google=>{
      if(!alive||!host.current)return;
      map.current=new google.maps.Map(host.current,{center:{lat:10.7,lng:76.7},zoom:11,streetViewControl:false,mapTypeControl:false});
      setReady(true);
    }).catch(()=>{if(alive)setMapError('Map could not load. Recorded locations are listed below.');});
    return()=>{alive=false;map.current=null;};
  },[]);
  useEffect(()=>{
    if(!ready||!map.current)return;
    const google=(window as any).google;
    const bounds=new google.maps.LatLngBounds();
    for(const pin of q.data?.pins || []){
      const position={lat:pin.latitude,lng:pin.longitude};bounds.extend(position);
      const marker=new google.maps.Marker({map:map.current,position,label:String(pin.number),title:`${pin.number}. ${label(pin)} · ${detail(pin)}`});
      const content=document.createElement('div'),heading=document.createElement('strong'),description=document.createElement('p');
      heading.textContent=`${pin.number}. ${label(pin)}`;description.textContent=detail(pin);content.append(heading,description);
      const popup=new google.maps.InfoWindow({content});
      marker.addListener('click',()=>{markers.current.forEach(item=>item.popup.close());popup.open({map:map.current,anchor:marker});});
      markers.current.set(pin.id,{marker,popup});
    }
    if(q.data?.pins.length){map.current.fitBounds(bounds);if(q.data.pins.length===1)map.current.setZoom(15);}
    return()=>{markers.current.forEach(({marker,popup})=>{popup.close();google.maps.event.clearInstanceListeners(marker);marker.setMap(null);});markers.current.clear();};
  },[ready,q.data]);
  function selectPin(pin:Pin){const item=markers.current.get(pin.id);if(!item||!map.current)return;markers.current.forEach(value=>value.popup.close());map.current.panTo({lat:pin.latitude,lng:pin.longitude});item.popup.open({map:map.current,anchor:item.marker});}
  return <section className="panel" style={{minWidth:0}}>
    <div className="panel-heading"><h2>{uiText('Check-in map')}</h2><button type="button" className="button secondary" onClick={()=>void q.refetch()} disabled={!day||q.isFetching}>{uiText('Refresh')}</button></div>
    <label>{uiText('Date (India)')}<input type="date" value={day} onChange={event=>setDay(event.target.value)}/></label>
    <p>{uiText('Saved attendance start, end and visit check-in locations, numbered by time. This is not live tracking or a travelled route.')}</p>
    <div ref={host} style={{height:380,width:'100%',borderRadius:14,border:'1px solid #dce6f2'}} aria-label={uiText('Check-in map')}/>
    {mapError&&<p role="alert">{uiText(mapError)}</p>}
    {!day?<p>{uiText('Choose a valid date.')}</p>:q.isPending?<p role="status">{uiText('Loading check-ins…')}</p>:q.isError?<p role="alert">{uiText('Check-in map unavailable. Please retry.')}</p>:<>
      {!q.data?.pins.length&&<p>{uiText('No saved check-in locations for this date.')}</p>}
      {!!q.data?.missingLocations&&<p>{uiText('Some records have no valid GPS coordinates and cannot be shown on the map.')}</p>}
      <ol>{q.data?.pins.map(pin=><li key={pin.id} style={{marginBottom:12,overflowWrap:'anywhere'}}><button type="button" className="button secondary" onClick={()=>selectPin(pin)}>{pin.number}. {label(pin)}</button><p>{detail(pin)}</p><a href={`https://www.google.com/maps/search/?api=1&query=${pin.latitude},${pin.longitude}`} target="_blank" rel="noopener noreferrer">{uiText('View recorded location')}</a></li>)}</ol>
    </>}
  </section>;
}
