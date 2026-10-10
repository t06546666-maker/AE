import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
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
    {open && <div className="modal-backdrop" onClick={event=>{if(event.target === event.currentTarget)setOpen(false);}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reporting-month-title" style={{maxWidth:420}}><div className="panel-heading"><h2 id="reporting-month-title">{uiText('Choose reporting month')}</h2><button type="button" className="icon-button" aria-label={uiText('Close')} onClick={()=>setOpen(false)}><X /></button></div><div className="two-column-form">
    <label>{uiText('Reporting month')}<select aria-label={uiText('Reporting month')} value={month} onChange={event => setDraft(`${year}-${String(event.target.value).padStart(2,'0')}`)}>
      {Array.from({length:12},(_,index) => <option key={index+1} value={index+1}>{new Date(2020,index,1).toLocaleDateString(locale,{month:'short'})}</option>)}
    </select></label>
    <label>{uiText('Reporting year')}<select aria-label={uiText('Reporting year')} value={year} onChange={event => { const nextYear=Number(event.target.value); setDraft(`${nextYear}-${String(month).padStart(2,'0')}`); }}>
      {Array.from({length:maxYear-1999},(_,index)=>maxYear-index).map(option => <option key={option} value={option}>{option}</option>)}
    </select></label></div><div className="modal-actions"><button className="button secondary" type="button" onClick={()=>setOpen(false)}>{uiText('Cancel')}</button><button className="button primary" type="button" onClick={()=>{onChange(draft);setOpen(false);}}>{uiText('Apply month')}</button></div></section></div>}
  </>;
}
