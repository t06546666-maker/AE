import './customer-bill-popup.css';
import {Check,ArrowRight} from 'lucide-react';
import {uiText} from '../uiText';
import {formatCurrency} from '../utils';
export type PaymentNotice={kind:'cash'|'upi';bill:{id:string;merchantName:string;payable:number}};
export function CustomerPaymentNotice({notice,busy=false,error='',onContinue}:{notice:PaymentNotice;busy?:boolean;error?:string;onContinue:()=>void}){
 const cash=notice.kind==='cash';
 return <div className="modal-backdrop ae-bill-backdrop"><section className="modal ae-bill ae-payment-notice" role="dialog" aria-modal="true" aria-labelledby="payment-notice-title"><div className="ae-payment-check" aria-hidden="true"><Check size={30}/></div><p className="ae-payment-eyebrow">{cash?'💵 AE CHECKOUT':'👋 AE CHECKOUT'}</p><h2 id="payment-notice-title">{uiText(cash?'Cash selected!':'Welcome back!')}</h2><p>{uiText(cash?'Please pay this amount at the shop counter.':'If you paid using UPI, please check with the shop that they received your payment.')}</p><div className="ae-payment-summary"><span>{uiText('Your bill')}</span><strong>{formatCurrency(notice.bill.payable)}</strong><small>{notice.bill.merchantName}</small></div><p className="ae-payment-friendly">{uiText(cash?'Thank you for shopping with AE! 🛍️':'Thank you for shopping with AE! 🛍️')}</p>{error&&<p role="alert" className="form-error">{uiText(error)}</p>}<button autoFocus type="button" className="button primary ae-bill-pay" disabled={busy} onClick={onContinue}>{uiText(busy?'Please wait…':'OK — Go Home')}<ArrowRight size={18}/></button></section></div>;
}
