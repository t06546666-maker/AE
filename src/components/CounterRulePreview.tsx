import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {apiFetch} from '../api';
import {uiText} from '../uiText';
import {formatCurrency} from '../utils';

type Policy={enabled:boolean;pointsPer100:number|string;discountType:'percentage'|'flat';discountValue:number;minimumBillAmount:number|string};
type Quote={amount:number;discountAmount:number;payable:number;pointsToRedeem:number;pointsToEarn:number};
export function CounterRulePreview({policy,unsaved}:{policy:Policy;unsaved:boolean}){
 useTranslation(undefined,{bindI18n:'languageChanged loaded'});
 const [amount,setAmount]=useState('500'),[action,setAction]=useState('combined');
 const input=JSON.stringify({amount,action,policy}),[settled,setSettled]=useState(input);
 useEffect(()=>{const timer=setTimeout(()=>setSettled(input),300);return()=>clearTimeout(timer);},[input]);
 const valid=!!amount&&!!String(policy.pointsPer100)&&!!String(policy.minimumBillAmount);
 const result=useQuery({queryKey:['merchant','counter-rule-preview',settled],enabled:valid&&input===settled,retry:false,queryFn:({signal})=>apiFetch<{quote:Quote}>('/api/merchant/counter-staff/preview',{method:'POST',body:settled,signal})});
 const quote=result.data?.quote;
 return <section className="ae-counter-rule-preview" aria-labelledby="counter-rule-preview-title"><h3 id="counter-rule-preview-title">{uiText('Live checkout preview')}</h3><p>{uiText(unsaved?'Preview of unsaved rules. Save rules to use them for checkout.':'Preview of your saved checkout rules.')}</p><label>{uiText('Sample bill amount (₹)')}<input aria-label={uiText('Sample bill amount (₹)')} type="number" min="1" max="10000000" step="0.01" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>{uiText('Checkout choice')}<select value={action} onChange={e=>setAction(e.target.value)}><option value="combined">{uiText('Redeem 100 points + earn')}</option><option value="earn">{uiText('Earn only — no redemption discount')}</option></select></label><p>{uiText(policy.discountType==='percentage'?'Percentage':'Flat amount')}: {policy.discountType==='percentage'?policy.discountValue+'%':formatCurrency(policy.discountValue)}</p><div aria-live="polite" aria-atomic="true">{!valid?<p>{uiText('Enter the sample amount and complete the rules to preview.')}</p>:input!==settled||result.isPending?<p>{uiText('Updating preview…')}</p>:result.error?<p role="alert">{uiText(result.error.message)}</p>:quote&&<dl className="ae-counter-preview-totals">{[['Bill',formatCurrency(quote.amount)],['Discount',formatCurrency(quote.discountAmount)],['Payable',formatCurrency(quote.payable)],['Points to redeem',quote.pointsToRedeem],['Points to earn',quote.pointsToEarn]].map(([label,value])=><div key={label}><dt>{uiText(label)}</dt><dd>{value}</dd></div>)}</dl>}</div><small>{uiText('Example only. No transaction is saved and no points are changed. Actual redemption requires 100 available customer points.')}</small></section>;
}
