import {useEffect,useState} from 'react';
import {Search,Store} from 'lucide-react';
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
 useEffect(()=>{if(!searchMerchants)return;const timer=setTimeout(()=>searchMerchants(query),300);return()=>clearTimeout(timer);},[query,searchMerchants]);
 const matches=filterProductMerchants(merchants,query);
 const selected=merchants.find(merchant=>merchant.id===value)||(savedSelection?.id===value?savedSelection:undefined);
 // Preserve the actual selection while searching; typing must never select a shop.
 const options=selected&&!matches.some(merchant=>merchant.id===value)?[selected,...matches]:matches;
 return <div className="ae-product-merchant-picker">
  <label className="ae-product-field"><Search aria-hidden="true"/><span className="ae-product-sr-only">{t('Search merchants')}</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t('Search merchants...')} autoComplete="off"/></label>
  {merchantsLoading&&<p role="status" className="ae-product-help">{t('Loading…')}</p>}
  {merchantsError&&<p role="alert" className="ae-product-help">{t('Unable to load merchants.')} <button type="button" onClick={retryMerchants}>{t('Retry')}</button></p>}
  {!merchantsLoading&&!merchantsError&&query.trim()&&!matches.length&&<p role="status" className="ae-product-help">{t('No merchants found.')}</p>}
  <label className="ae-product-field"><Store aria-hidden="true"/><span className="ae-product-sr-only">{t('Select merchant')}</span><select required value={value} onChange={event=>{setSavedSelection(options.find(merchant=>merchant.id===event.target.value));onChange(event.target.value);}}><option value="">{t('Select merchant')}</option>{options.map(merchant=><option key={merchant.id} value={merchant.id}>{merchant.merchant_name}</option>)}</select></label>
  {hasMoreMerchants&&<button type="button" className="ae-product-more" disabled={merchantsLoading} onClick={loadMoreMerchants}>{t('Load more merchants')}</button>}
 </div>;
}
