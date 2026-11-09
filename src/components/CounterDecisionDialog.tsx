import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {uiText} from '../uiText';
import {formatCurrency} from '../utils';
export type CounterAction='confirm'|'return'|'cancel';
export function CounterDecisionDialog({action,amount,customerName,busy,error,onClose,onSubmit}:{action:CounterAction;amount:number;customerName:string;busy:boolean;error:string;onClose:()=>void;onSubmit:(reason:string)=>void}){
 useTranslation(undefined,{bindI18n:'languageChanged loaded'});
 const ref=useRef<HTMLDialogElement>(null),titleId=useId(),reasonId=useId(),[reason,setReason]=useState('');
 useEffect(()=>{const element=ref.current,opener=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';element?.showModal();return()=>{element?.close();document.body.style.overflow=overflow;if(opener?.isConnected)opener.focus();};},[]);
 const title=uiText(action==='confirm'?'Confirm amount':action==='return'?'Return for correction':'Cancel checkout');
 return createPortal(<dialog ref={ref} className="ae-counter-decision" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
 <form onSubmit={event=>{event.preventDefault();if(!busy&&(action==='confirm'||reason.trim()))onSubmit(reason.trim());}}><h2 id={titleId}>{title}</h2><p className="ae-counter-decision-customer">{customerName}</p><strong className="ae-counter-decision-amount">{formatCurrency(amount)}</strong>
 {action==='confirm'?<p>{uiText('The merchant’s saved discount and points rules apply. This does not confirm payment receipt.')}</p>:<label htmlFor={reasonId}>{uiText(action==='return'?'Reason to return for correction':'Reason to cancel checkout')}<textarea id={reasonId} value={reason} onChange={event=>setReason(event.target.value)} required maxLength={500} rows={4} autoFocus/></label>}
 {error&&<p className="form-error" role="alert">{uiText(error)}</p>}<div className="ae-counter-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>{uiText('Go back')}</button><button type="submit" className={'button '+(action==='cancel'?'danger':'primary')} disabled={busy||(action!=='confirm'&&!reason.trim())} autoFocus={action==='confirm'}>{uiText(busy?'Saving…':action==='confirm'?'Confirm amount':action==='return'?'Return for correction':'Cancel checkout')}</button></div></form></dialog>,document.body);
}
