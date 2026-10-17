import { uiText } from '../uiText';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { apiFetch } from '../api';
import { formatCurrency } from '../utils';
import { ArrowUpRight, Banknote, CheckCircle2, ReceiptText, X } from 'lucide-react';
import './customer-bill-popup.css';

const upi = registerPlugin<{ open(options: { id: string; url?: string }): Promise<void> }>('UpiApps');
type Bill = { id: string; merchantName: string; total: number; discount: number; payable: number; paymentMode?: 'cash' | 'customer_payment'; paymentStatus?: 'paid' | 'pending'; upiId?: string | null; upiUrl?: string | null };
export function CustomerBillPopup({ customerId }: { customerId: string }) {
  const client = useQueryClient();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const bills = useQuery({ queryKey: ['customer', 'checkout-bills', customerId], queryFn: ({ signal }) => apiFetch<{ bills: Bill[] }>('/api/customer/checkout-bills', { signal }), refetchInterval: query => query.state.data?.bills?.length ? 2000 : 30000 });
  const bill = bills.data?.bills[0];
  async function dismiss() {
    if (!bill || busy) return;
    setBusy(true); setError('');
    try { await apiFetch(`/api/customer/checkout-bills/${bill.id}/dismiss`, { method: 'POST' }); await client.invalidateQueries({ queryKey: ['customer', 'checkout-bills'] }); }
    catch { setError('Could not close this bill. Please try again.'); }
    finally { setBusy(false); }
  }
  async function pay() {
    if (opening) return;
    setError('');
    if (!bill?.upiUrl) { setError('This merchant has not enabled UPI payments.'); return; }
    if (Capacitor.getPlatform() !== 'android') { setError('Open AE on your Android phone to launch an installed UPI app.'); return; }
    setOpening(true);
    try { await upi.open({ id: '', url: bill.upiUrl }); }
    catch { setError('Could not open this payment. Try another UPI app.'); }
    finally { setOpening(false); }
  }
  if (!bill) return null;
  const cashReceived = bill.paymentMode === 'cash' && bill.paymentStatus === 'paid';
  return <div className="modal-backdrop ae-bill-backdrop"><section className="modal ae-bill" role="dialog" aria-modal="true" aria-labelledby="ae-bill-title">
    <header className="ae-bill-header"><span className="ae-bill-icon"><ReceiptText size={22}/></span><div><h2 id="ae-bill-title">{uiText("Your bill")}</h2><p>{bill.merchantName}</p></div><button type="button" className="icon-button" aria-label={uiText("Close bill")} disabled={busy} onClick={() => void dismiss()}><X size={20}/></button></header>
    <div className="ae-bill-amount"><span>{cashReceived ? uiText("Amount paid") : uiText("Amount to pay")}</span><strong>{formatCurrency(bill.payable)}</strong><small>{cashReceived ? uiText("Paid in cash") : bill.discount > 0 ? uiText("After your AE discount") : uiText("Bill total")}</small></div>
    <dl className="ae-bill-breakdown"><div><dt>{uiText("Bill total")}</dt><dd>{formatCurrency(bill.total)}</dd></div>{bill.discount > 0 ? <div><dt>{uiText("Discount")}</dt><dd>− {formatCurrency(bill.discount)}</dd></div> : null}</dl>
    {cashReceived ? <div className="ae-bill-cash-confirmed" role="status"><CheckCircle2 size={23}/><div><strong>{uiText("Cash received")}</strong><span>{uiText("The merchant confirmed this payment. No further payment is due.")}</span></div></div> : <>
      <div className="ae-bill-payment-options">
        <button type="button" className="ae-bill-cash" disabled={busy || opening} onClick={() => void dismiss()}><Banknote size={19}/>{uiText("Pay with cash")}</button>
        {bill.upiUrl ? <button type="button" className="button primary ae-bill-pay" disabled={opening || busy} onClick={() => void pay()}>{opening ? uiText("Opening UPI…") : uiText("Pay with UPI")}<ArrowUpRight size={18}/></button> : <div className="ae-bill-in-app-only" role="status"><strong>{uiText("UPI is not available for this merchant")}</strong><span>{uiText("You can pay with cash at the shop.")}</span></div>}
      </div>
      {bill.upiUrl && bill.upiId && <p className="ae-bill-recipient">{uiText("Pay to ")}<strong>{bill.upiId}</strong></p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {bill.upiUrl && <p className="ae-bill-note">{uiText("Pay with UPI opens your installed UPI app with the merchant and amount filled in.")}</p>}
    </>}
  </section></div>;
}
