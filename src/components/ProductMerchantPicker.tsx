import {useEffect,useId,useRef,useState} from 'react';
import {Check,ChevronDown,Search,Store} from 'lucide-react';
import {uiText as t} from '../uiText';

type Merchant={id:string;merchant_name:string};
export function filterProductMerchants(merchants:Merchant[],query:string){
 const term=query.normalize('NFKC').trim().toLocaleLowerCase();
 return merchants.filter(merchant=>merchant.merchant_name.normalize('NFKC').toLocaleLowerCase().includes(term));
}
export type MerchantSearchProps={searchMerchants?:(query:string)=>void;merchantsLoading?:boolean;merchantsError?:boolean;loadMoreMerchants?:()=>void;hasMoreMerchants?:boolean;retryMerchants?:()=>void};
export function ProductMerchantPicker({merchants,value,onChange,searchMerchants,merchantsLoading,merchantsError,loadMoreMerchants,hasMoreMerchants,retryMerchants}:{merchants:Merchant[];value:string;onChange:(id:string)=>void}&MerchantSearchProps){
 const [query,setQuery]=useState('');
 const [savedSelection,setSavedSelection]=useState<Merchant|undefined>();
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(0);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null);
 const id=useId();
 useEffect(()=>{if(!searchMerchants)return;const timer=setTimeout(()=>searchMerchants(query),300);return()=>clearTimeout(timer);},[query,searchMerchants]);
 useEffect(()=>{if(open)search.current?.focus();},[open]);
 useEffect(()=>{if(!open)return;function outside(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false);}document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 const matches=filterProductMerchants(merchants,query);
 const selected=merchants.find(merchant=>merchant.id===value)||(savedSelection?.id===value?savedSelection:undefined);
 const activeIndex=Math.max(0,Math.min(active,Math.max(0,matches.length-1)));
 useEffect(()=>{if(open)root.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:'nearest'});},[open,activeIndex,query]);
 function choose(merchant:Merchant){setSavedSelection(merchant);onChange(merchant.id);setOpen(false);setQuery('');setActive(0);trigger.current?.focus();}
 function close(){setOpen(false);trigger.current?.focus();}
 return <div className="ae-product-merchant-picker" ref={root} onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();}}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}>
  <button ref={trigger} type="button" className="ae-product-field ae-product-merchant-trigger" aria-label={t('Select merchant')} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);}}}><Store aria-hidden="true"/><span>{selected?.merchant_name||t('Select merchant')}</span><ChevronDown aria-hidden="true"/></button>
  {open&&<div id={id} role="dialog" aria-label={t('Select merchant')} className="ae-product-merchant-dropdown">
   <label className="ae-product-field ae-product-merchant-search"><Search aria-hidden="true"/><span className="ae-product-sr-only">{t('Search merchants')}</span><input ref={search} type="search" role="combobox" aria-autocomplete="list" aria-expanded={true} aria-controls={`${id}-options`} aria-activedescendant={matches.length?`${id}-option-${activeIndex}`:undefined} value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}} placeholder={t('Search merchants...')} autoComplete="off" onKeyDown={event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();setActive(event.key==='Home'?0:event.key==='End'?Math.max(0,matches.length-1):event.key==='ArrowDown'?Math.min(activeIndex+1,matches.length-1):Math.max(0,activeIndex-1));}else if(event.key==='Enter'){event.preventDefault();if(matches[activeIndex])choose(matches[activeIndex]);}}}/></label>
   {merchantsLoading&&<p role="status" className="ae-product-help">{t('Loading…')}</p>}
   {merchantsError&&<p role="alert" className="ae-product-help">{t('Unable to load merchants.')} <button type="button" onClick={retryMerchants}>{t('Retry')}</button></p>}
   {!merchantsLoading&&!merchantsError&&!matches.length&&<p role="status" className="ae-product-help">{t('No merchants found.')}</p>}
   <div id={`${id}-options`} role="listbox" aria-label={t('Select merchant')} className="ae-product-merchant-options">{matches.map((merchant,index)=><button type="button" role="option" id={`${id}-option-${index}`} key={merchant.id} aria-selected={merchant.id===value} data-active={index===activeIndex} className="ae-product-merchant-option" onMouseDown={event=>event.preventDefault()} onClick={()=>choose(merchant)}><span>{merchant.merchant_name}</span>{merchant.id===value&&<Check size={18} aria-hidden="true"/>}</button>)}</div>
   {hasMoreMerchants&&<button type="button" className="ae-product-more" disabled={merchantsLoading} onClick={loadMoreMerchants}>{t('Load more merchants')}</button>}
  </div>}
 </div>;
}
