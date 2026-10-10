import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { uiText } from '../uiText';

export function ReportingMonth({ value, maximum, onChange }: { value: string; maximum: string; onChange: (value: string) => void }) {
  const { i18n } = useTranslation();
  const [open,setOpen] = useState(false);
  const [draft,setDraft] = useState(value);
  const year = Number(draft.slice(0,4));
  const month = Number(draft.slice(5));
  const maxYear = Number(maximum.slice(0,4));
  const locale = i18n.resolvedLanguage === 'ml' ? 'ml-IN' : 'en-IN';
  return <><button type="button" className="mo-month mo-month-button" onClick={()=>{setDraft(value);setOpen(true);}} aria-haspopup="dialog"><CalendarDays size={17} aria-hidden="true" /><span>{new Date(`${value}-01T12:00:00`).toLocaleDateString(locale,{month:'short',year:'numeric'})}</span></button>
    {open && createPortal(<div className="modal-backdrop" style={{zIndex:1500,padding:12}} onClick={event=>{if(event.target === event.currentTarget)setOpen(false);}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reporting-month-title" style={{maxWidth:420,maxHeight:'calc(100dvh - 24px)',overflowY:'auto',color:'var(--text)'}}><div className="panel-heading"><h2 id="reporting-month-title">{uiText('Choose reporting month')}</h2><button type="button" className="icon-button" aria-label={uiText('Close')} onClick={()=>setOpen(false)}><X /></button></div>
    <label>{uiText('Reporting year')}<select aria-label={uiText('Reporting year')} value={year} onChange={event => { const nextYear=Number(event.target.value); setDraft(`${nextYear}-${String(month).padStart(2,'0')}`); }}>
      {Array.from({length:maxYear-1999},(_,index)=>maxYear-index).map(option => <option key={option} value={option}>{option}</option>)}
    </select></label><div role="group" aria-label={uiText('Reporting month')} style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,marginTop:16}}>{Array.from({length:12},(_,index)=><button type="button" className={`button ${month===index+1?'primary':'secondary'}`} style={{minHeight:44,minWidth:0,padding:'8px 4px',whiteSpace:'normal',overflowWrap:'anywhere'}} key={index+1} aria-pressed={month===index+1} onClick={()=>setDraft(`${year}-${String(index+1).padStart(2,'0')}`)}>{new Date(2020,index,1).toLocaleDateString(locale,{month:'short'})}</button>)}</div><div className="modal-actions"><button className="button secondary" type="button" onClick={()=>setOpen(false)}>{uiText('Cancel')}</button><button className="button primary" type="button" onClick={()=>{onChange(draft);setOpen(false);}}>{uiText('Apply month')}</button></div></section></div>,document.body)}
  </>;
}
