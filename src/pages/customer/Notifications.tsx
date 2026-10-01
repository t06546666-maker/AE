import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import { useCustomerTransactions } from '../../hooks/useCustomerData';

export function CustomerNotifications() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useCustomerTransactions(page);
  return <div className="min-h-screen bg-gray-50 pb-28 text-gray-900">
    <header className="flex items-center gap-4 bg-white px-5 py-4 shadow-sm"><Link to="/customer/home" aria-label="Back"><ArrowLeft /></Link><h1 className="text-lg font-bold">Notifications</h1></header>
    <main className="space-y-4 p-5">
      <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Notifications are enabled automatically when you sign in. AE will alert you about purchases, rewards, redemptions and payment requests.</p>
      <h2 className="font-bold">Purchase and redemption activity</h2>
      {isLoading && <p>Loading…</p>}
      {error && <div role="alert"><p>{error.message}</p><button onClick={() => void refetch()}>Try again</button></div>}
      {!isLoading && !error && !data?.transactions.length && <p>No purchase or redemption activity yet.</p>}
      {data?.transactions.map(item => <Link key={`${item.type}-${item.id}`} to="/customer/transactions" className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <Bell className="shrink-0 text-blue-600" /><div><p className="font-bold">{Number(item.points).toLocaleString('en-IN')} points {item.type === 'earn' ? 'received' : 'redeemed'}</p><p>{item.merchant_name || 'AE Merchant'}</p><time className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString('en-IN')}</time></div>
      </Link>)}
      <div className="flex justify-between"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button disabled={!data || page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>
    </main>
  </div>;
}
