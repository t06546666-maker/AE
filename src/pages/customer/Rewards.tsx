import { uiText } from '../../uiText';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { UserProfile } from '../../types';

export function CustomerRewards({ user }: { user: UserProfile }) {
  const [redeemQr, setRedeemQr] = useState('');
  const [qrError, setQrError] = useState(false);
  useEffect(() => {
    let active = true;
    setRedeemQr(''); setQrError(false);
    QRCode.toDataURL(JSON.stringify({ id: user.customer_code || user.id, transactionMode: 'combined' }), { width: 280, margin: 4, color: { dark: '#101a37', light: '#ffffff' } })
      .then(src => { if (active) setRedeemQr(src); })
      .catch(() => { if (active) setQrError(true); });
    return () => { active = false; };
  }, [user.customer_code, user.id]);

  return <div className="customer-modern-page min-h-screen pb-[100px] text-gray-900">
    <header className="flex items-center gap-4 px-5 py-4">
      <Link to="/customer/home" aria-label={uiText("Back to home")}><ArrowLeft size={24}/></Link>
      <h1 className="text-lg font-bold">{uiText("Redeem QR")}</h1>
    </header>
    <section className="mx-5 mt-5 rounded-3xl border border-blue-100 bg-white p-5 text-center shadow-sm">
      <h2 className="text-xl font-bold">{uiText("Redeem + Receive")}</h2>
      <p className="mt-2 text-sm text-gray-500">{uiText("Show this QR to your merchant to redeem 100 points and earn points on your purchase.")}</p>
      {redeemQr ? <img src={redeemQr} alt={uiText("Customer QR for Redeem + Issue")} className="mx-auto mt-4 h-60 w-60 max-w-full"/> : <p className="py-12 text-sm text-gray-500" role="status">{qrError ? uiText("Unable to create QR. Please reload this page.") : uiText("Loading QR…")}</p>}
      <p className="mt-2 font-bold">{user.name || 'Customer'}</p><p className="mt-1 text-xs text-gray-500">{user.customer_code || user.id}</p>
    </section>
  </div>;
}
