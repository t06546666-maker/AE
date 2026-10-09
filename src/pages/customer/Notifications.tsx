import { uiText } from '../../uiText';
import { formatDateTime } from '../../utils';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import { useCustomerTransactions } from '../../hooks/useCustomerData';

export function CustomerNotifications() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useCustomerTransactions(page);
  return <div className="min-h-screen bg-gray-50 pb-28 text-gray-900">
    <header className="flex items-center gap-4 bg-white px-5 py-4 shadow-sm"><Link to="/customer/home" aria-label={uiText("Back")}><ArrowLeft /></Link><h1 className="text-lg font-bold">{uiText("Notifications")}</h1></header>
    <main className="space-y-4 p-5">
      <h2 className="font-bold">{uiText("Purchase and redemption activity")}</h2>
      {isLoading && <p>{uiText("Loading…")}</p>}
      {error && <div role="alert"><p>{error.message}</p><button onClick={() => void refetch()}>{uiText("Try again")}</button></div>}
      {!isLoading && !error && !data?.transactions.length && <p>{uiText("No purchase or redemption activity yet.")}</p>}
      {data?.transactions.map(item => <Link key={`${item.type}-${item.id}`} to="/customer/transactions" className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <Bell className="shrink-0 text-blue-600" /><div><p className="font-bold">{item.type === 'bonus' ? uiText("Thank you for your loyalty! 💙") : `₹${Number(item.amount || 0).toLocaleString('en-IN')} ${item.type === 'earn' ? uiText("purchase") : uiText("redemption")}`}</p><p>{Number(item.points).toLocaleString('en-IN')}{uiText(" points ")}{item.type !== 'redeem' ? uiText("earned") : uiText("redeemed")} · {item.merchant_name || 'AE Merchant'}</p>{item.type === 'bonus' && <p>{uiText("You received ")}{Number(item.points).toLocaleString('en-IN')}{uiText(" AE loyalty points. Thank you for your loyalty!")}</p>}<time className="text-xs text-gray-500">{formatDateTime(item.created_at)}</time></div>
      </Link>)}
      <div className="flex justify-between"><button disabled={page === 1} onClick={() => setPage(page - 1)}>{uiText("Previous")}</button><button disabled={!data || page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>{uiText("Next")}</button></div>
    </main>
  </div>;
}
