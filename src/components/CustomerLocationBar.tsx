import { uiText } from '../uiText';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './customer-location-picker.css';
import { Check, ChevronDown, MapPin, X } from 'lucide-react';
import { useCustomerLocation } from '../hooks/useCustomerLocation';

const CUSTOMER_AREAS = [
  { area: 'Chittur', routeGroup: 'chittur' },
  { area: 'Thathamangalam', routeGroup: 'thathamangalam' },
] as const;

export function CustomerLocationBar({ compact = false }: { compact?: boolean }) {
  const location = useCustomerLocation(false);
  const [open, setOpen] = useState(false);
  const [viewport,setViewport]=useState({top:0,height:window.innerHeight});
  useEffect(()=>{
    if(!open)return;
    const update=()=>setViewport({top:window.visualViewport?.offsetTop || 0,height:window.visualViewport?.height || window.innerHeight});
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';update();
    window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);window.addEventListener('resize',update);document.addEventListener('keydown',escape);
    return()=>{document.body.style.overflow=overflow;window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);document.removeEventListener('keydown',escape)};
  },[open]);
  const selectArea = (area: typeof CUSTOMER_AREAS[number]) => {
    location.selectLocation({ area: area.area, routeGroup: area.routeGroup });
    setOpen(false);
  };
  return <>
    {compact ? <button type="button" className="ae-location-pill" onClick={() => setOpen(true)} aria-label={uiText("Choose shopping location")}><MapPin size={21}/><span>{location.data?.area || uiText('Select location')}</span><ChevronDown size={16}/></button> : <button type="button" className="mx-4 my-2 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-gray-900" onClick={() => setOpen(true)} aria-label={uiText("Choose shopping location")}><MapPin size={20}/><span>{location.data?.area || uiText('Select shopping area')}</span><ChevronDown size={18}/></button>}
    {open && createPortal(<div className="modal-backdrop ae-location-overlay" style={{top:viewport.top,height:viewport.height}} onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="ae-location-title" style={{ maxWidth: 440 }}><div className="panel-heading"><h2 id="ae-location-title">{uiText("Choose your location")}</h2><button type="button" className="icon-button" aria-label={uiText("Close location picker")} onClick={() => setOpen(false)}><X size={20}/></button></div><p>{uiText("Choose an area to see shops assigned to its routes.")}</p><div aria-live="polite" style={{ display: 'grid', gap: 10, marginTop: 16 }}>{CUSTOMER_AREAS.map(area => <button key={area.routeGroup} type="button" className="button secondary" style={{ textAlign: 'left', whiteSpace: 'normal', justifyContent: 'space-between' }} onClick={() => selectArea(area)}><span><MapPin size={18}/>{uiText(area.area)}</span>{location.data?.routeGroup === area.routeGroup && <Check size={18}/>}</button>)}</div></section></div>,document.body)}
  </>;
}
