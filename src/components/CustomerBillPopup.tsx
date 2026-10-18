import { uiText } from '../uiText';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { apiFetch } from '../api';
import { formatCurrency } from '../utils';
import { Banknote, CheckCircle2, QrCode, ReceiptText, X } from 'lucide-react';
import './customer-bill-popup.css';

type UpiApp = { id: string; name: string };
const upi = registerPlugin<{ list(): Promise<{ apps: UpiApp[] }>; open(options: { id: string }): Promise<void> }>('UpiApps');
type Bill = { id: string; merchantName: string; total: number; discount: number; payable: number; paymentMode?: 'cash' | 'customer_payment'; paymentStatus?: 'paid' | 'pending' };
export function CustomerBillPopup({ customerId }: { customerId: string }) {
  const client = useQueryClient();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [upiApps, setUpiApps] = useState<UpiApp[]>([]);
  const bills = useQuery({ queryKey: ['customer', 'checkout-bills', customerId], queryFn: ({ signal }) => apiFetch<{ bills: Bill[] }>('/api/customer/checkout-bills', { signal }), refetchInterval: query => query.state.data?.bills?.length ? 2000 : 30000 });
  const bill = bills.data?.bills[0];
  async function dismiss() {
    if (!bill || busy) return;
    setBusy(true); setError('');
    try { await apiFetch(`/api/customer/checkout-bills/${bill.id}/dismiss`, { method: 'POST' }); await client.invalidateQueries({ queryKey: ['customer', 'checkout-bills'] }); }
    catch { setError('Could not close this bill. Please try again.'); }
    finally { setBusy(false); }
  }
  async function chooseUpiApp() {
    if (opening) return;
    setError('');
    if (Capacitor.getPlatform() !== 'android') { setError(uiText('Open AE on your Android phone to launch an installed UPI app.')); return; }
    setOpening(true);
    try {
      const { apps } = await upi.list();
      if (!apps.length) { setError(uiText('No supported UPI app was found. Install or update your UPI app, then try again.')); return; }
      setUpiApps(apps);
    }
    catch { setError(uiText('Could not find an installed UPI app. Please try again on your Android phone.')); }
    finally { setOpening(false); }
  }
  async function openUpiApp(app: UpiApp) {
    if (opening) return;
    setOpening(true); setError('');
    try { await upi.open({ id: app.id }); setUpiApps([]); }
    catch { setError(uiText('Could not open this UPI app. Try another one.')); }
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
        <button type="button" className="button primary ae-bill-pay" disabled={opening || busy} onClick={() => void chooseUpiApp()}>{opening ? uiText("Opening UPI apps…") : uiText("Scan shop QR in UPI app")}<QrCode size={18}/></button>
      </div>
      {upiApps.length > 0 && <div className="ae-bill-apps" aria-label={uiText("Choose a UPI app")}><h3>{uiText("Choose a UPI app")}</h3><div>{upiApps.map(app => <button type="button" className="ae-bill-app" key={app.id} disabled={opening} onClick={() => void openUpiApp(app)}><span className={`ae-bill-app-mark ${app.name.toLowerCase().replace(/[^a-z]/g, '')}`}>{app.name[0]}</span>{app.name}<QrCode size={16}/></button>)}</div></div>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <p className="ae-bill-note">{uiText("This only opens your UPI app. Choose Scan QR there and scan the shop’s own QR code. AE does not start or confirm a payment.")}</p>
    </>}
  </section></div>;
}
