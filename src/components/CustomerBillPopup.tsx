import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { apiFetch } from '../api';
import { formatCurrency } from '../utils';
import { ArrowUpRight, ChevronRight, ReceiptText, X } from 'lucide-react';
import './customer-bill-popup.css';

const upi = registerPlugin<{ list(): Promise<{ apps: { id: string; name: string }[] }>; open(options: { id: string; url?: string }): Promise<void> }>('UpiApps');
type Bill = { id: string; merchantName: string; total: number; discount: number; payable: number; upiId?: string | null; upiUrl?: string | null };
export function CustomerBillPopup({ customerId }: { customerId: string }) {
  const client = useQueryClient();
  const [apps, setApps] = useState<{ id: string; name: string }[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const bills = useQuery({ queryKey: ['customer', 'checkout-bills', customerId], queryFn: ({ signal }) => apiFetch<{ bills: Bill[] }>('/api/customer/checkout-bills', { signal }), refetchInterval: 2000 });
  const bill = bills.data?.bills[0];
  async function dismiss() {
    if (!bill || busy) return;
    setBusy(true); setError('');
    try { await apiFetch(`/api/customer/checkout-bills/${bill.id}/dismiss`, { method: 'POST' }); setApps(null); await client.invalidateQueries({ queryKey: ['customer', 'checkout-bills'] }); }
    catch { setError('Could not close this bill. Please try again.'); }
    finally { setBusy(false); }
  }
  async function pay() {
    if (opening) return;
    setError('');
    if (Capacitor.getPlatform() !== 'android') { setError('Open AE on your Android phone to launch an installed UPI app.'); return; }
    setOpening(true);
    try { const result = await upi.list(); setApps(result.apps); if (!result.apps.length) setError('No supported UPI app found. Install Google Pay, PhonePe, Paytm or BHIM.'); }
    catch { setError('UPI app opening requires the updated Android APK.'); }
    finally { setOpening(false); }
  }
  async function openApp(id: string) {
    if (!bill || opening) return;
    setOpening(true); setError('');
    try { await upi.open({ id, ...(bill.upiUrl ? { url: bill.upiUrl } : {}) }); }
    catch { setError('Could not open this payment. Try another UPI app.'); }
    finally { setOpening(false); }
  }
  if (!bill) return null;
  return <div className="modal-backdrop ae-bill-backdrop"><section className="modal ae-bill" role="dialog" aria-modal="true" aria-labelledby="ae-bill-title">
    <header className="ae-bill-header"><span className="ae-bill-icon"><ReceiptText size={22}/></span><div><h2 id="ae-bill-title">Your bill</h2><p>{bill.merchantName}</p></div><button type="button" className="icon-button" aria-label="Close bill" disabled={busy} onClick={() => void dismiss()}><X size={20}/></button></header>
    <div className="ae-bill-amount"><span>Amount to pay</span><strong>{formatCurrency(bill.payable)}</strong><small>After your AE discount</small></div>
    <dl className="ae-bill-breakdown"><div><dt>Bill total</dt><dd>{formatCurrency(bill.total)}</dd></div><div><dt>Discount</dt><dd>− {formatCurrency(bill.discount)}</dd></div></dl>
    {bill.upiId && <p className="ae-bill-recipient">Pay to <strong>{bill.upiId}</strong></p>}
    {apps && apps.length > 0 ? <div className="ae-bill-apps"><h3>Open your preferred app</h3><div>{apps.map(app => <button type="button" key={app.id} className="ae-bill-app" disabled={opening} onClick={() => void openApp(app.id)}><span className={`ae-bill-app-mark ${app.name === 'PhonePe' ? 'phonepe' : app.name === 'Paytm' ? 'paytm' : ''}`} aria-hidden="true">{app.name === 'Google Pay' ? 'G' : app.name === 'PhonePe' ? 'P' : app.name === 'Paytm' ? 'paytm' : 'B'}</span><span>{app.name}</span><ArrowUpRight size={16}/></button>)}</div></div> : <button type="button" className="button primary ae-bill-pay" disabled={opening || busy} onClick={() => void pay()}>{opening ? 'Finding apps…' : 'Pay'}<ChevronRight size={18}/></button>}
    {apps && bill.upiUrl && <button type="button" className="ae-bill-later" disabled={opening} onClick={() => void openApp('')}>Other UPI app</button>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <p className="ae-bill-note">{bill.upiUrl ? 'Recipient and payable amount open in your UPI app. Check the recipient before paying. AE does not confirm payment.' : 'Opens your UPI app only. No payment details are shared and AE does not confirm payment.'}</p>
    <button type="button" className="ae-bill-later" disabled={busy} onClick={() => void dismiss()}>{busy ? 'Closing…' : 'Close for now'}</button>
  </section></div>;
}
