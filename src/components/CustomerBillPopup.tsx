import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { apiFetch } from '../api';
import { formatCurrency } from '../utils';

const upi = registerPlugin<{ list(): Promise<{ apps: { id: string; name: string }[] }>; open(options: { id: string }): Promise<void> }>('UpiApps');
type Bill = { id: string; merchantName: string; total: number; discount: number; payable: number };
export function CustomerBillPopup({ customerId }: { customerId: string }) {
  const client = useQueryClient();
  const [apps, setApps] = useState<{ id: string; name: string }[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bills = useQuery({ queryKey: ['customer', 'checkout-bills', customerId], queryFn: ({ signal }) => apiFetch<{ bills: Bill[] }>('/api/customer/checkout-bills', { signal }), refetchInterval: 5000 });
  const bill = bills.data?.bills[0];
  async function dismiss() {
    if (!bill || busy) return;
    setBusy(true); setError('');
    try { await apiFetch(`/api/customer/checkout-bills/${bill.id}/dismiss`, { method: 'POST' }); setApps(null); await client.invalidateQueries({ queryKey: ['customer', 'checkout-bills'] }); }
    catch { setError('Could not close this bill. Please try again.'); }
    finally { setBusy(false); }
  }
  async function pay() {
    setError('');
    if (Capacitor.getPlatform() !== 'android') { setError('Open AE on your Android phone to launch an installed UPI app.'); return; }
    try { const result = await upi.list(); setApps(result.apps); if (!result.apps.length) setError('No supported UPI app found. Install Google Pay, PhonePe, Paytm or BHIM.'); }
    catch { setError('UPI app opening requires the updated Android APK.'); }
  }
  if (!bill) return null;
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Your checkout bill"><h2>Your bill</h2><p>{bill.merchantName}</p><dl><div><dt>Bill total</dt><dd>{formatCurrency(bill.total)}</dd></div><div><dt>Discount</dt><dd>{formatCurrency(bill.discount)}</dd></div><div><dt>Final payable amount</dt><dd><strong>{formatCurrency(bill.payable)}</strong></dd></div></dl><p>Payment is handled outside AE. Opening an app does not confirm payment.</p>{error && <p role="alert" className="form-error">{error}</p>}{apps?.map(app => <button type="button" className="button secondary" key={app.id} onClick={() => void upi.open({ id: app.id }).catch(() => setError('Could not open this UPI app.'))}>{app.name}</button>)}<div className="form-actions"><button type="button" className="button primary" onClick={() => void pay()}>Pay</button><button type="button" className="button secondary" disabled={busy} onClick={() => void dismiss()}>{busy ? 'Closing…' : 'Close'}</button></div></section></div>;
}
