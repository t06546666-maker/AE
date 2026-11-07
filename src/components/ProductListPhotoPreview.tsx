import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {X,ZoomIn,ZoomOut,RotateCcw} from 'lucide-react';
import {uiText} from '../uiText';
import './product-list-photo-preview.css';

export function ProductListPhotoPreview({src,customerName,onClose,onReload}:{src:string;customerName:string;onClose:()=>void;onReload:()=>Promise<unknown>}){
 useTranslation(undefined,{bindI18n:'languageChanged loaded'});
 const dialog=useRef<HTMLDialogElement>(null),viewport=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 const [zoom,setZoom]=useState(1),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const element=dialog.current,opener=document.activeElement as HTMLElement|null,previous=document.body.style.overflow;document.body.style.overflow='hidden';element?.showModal();return()=>{element?.close();document.body.style.overflow=previous;if(opener?.isConnected)opener.focus();};},[]);
 useEffect(()=>{setZoom(1);setLoading(true);setFailed(false);viewport.current?.scrollTo(0,0);},[src,attempt]);
 async function reload(){setLoading(true);setFailed(false);try{await onReload();setAttempt(value=>value+1);}catch{setLoading(false);setFailed(true);}}
 return createPortal(<dialog ref={dialog} className="ae-list-photo-dialog" aria-labelledby="ae-list-photo-title" onCancel={event=>{event.preventDefault();close.current();}} onClick={event=>{if(event.target===event.currentTarget)close.current();}}>
  <header className="ae-list-photo-header"><div><h2 id="ae-list-photo-title">{uiText('Product list photo')}</h2><p>{customerName}</p></div><div className="ae-list-photo-tools"><button type="button" disabled={zoom===1||failed} aria-label={uiText('Zoom Out')} title={uiText('Zoom Out')} onClick={()=>setZoom(value=>Math.max(1,value-.5))}><ZoomOut/></button><output aria-live="polite">{Math.round(zoom*100)}%</output><button type="button" disabled={zoom===3||failed} aria-label={uiText('Zoom In')} title={uiText('Zoom In')} onClick={()=>setZoom(value=>Math.min(3,value+.5))}><ZoomIn/></button><button type="button" aria-label={uiText('Reset zoom')} title={uiText('Reset zoom')} onClick={()=>{setZoom(1);viewport.current?.scrollTo(0,0);}}><RotateCcw/></button><button type="button" autoFocus aria-label={uiText('Close photo preview')} title={uiText('Close')} onClick={()=>close.current()}><X/></button></div></header>
  <div className="ae-list-photo-viewport" ref={viewport} aria-busy={loading}>{loading&&<p role="status" className="ae-list-photo-status">{uiText('Loading photo…')}</p>}{failed?<div className="ae-list-photo-status" role="alert"><p>{uiText('Unable to load this photo. Please try again.')}</p><button type="button" className="button secondary" onClick={()=>void reload()}>{uiText('Reload photo')}</button></div>:<div className="ae-list-photo-canvas" style={{width:zoom*100+'%'}}><img key={src+':'+attempt} src={src} alt={uiText('Submitted product list')} onLoad={()=>setLoading(false)} onError={()=>{setLoading(false);setFailed(true);}}/></div>}</div>
 </dialog>,document.body);
}
