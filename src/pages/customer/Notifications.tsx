import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import { useCustomerTransactions } from '../../hooks/useCustomerData';
import { apiFetch } from '../../api';

export function CustomerNotifications() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useCustomerTransactions(page);
  const [testStatus, setTestStatus] = useState('');
  const [testing, setTesting] = useState(false);
  async function testPush() {
    setTesting(true);
    try {
      await apiFetch('/api/customer/notifications/test', { method: 'POST' });
      setTestStatus('Firebase accepted the test. Check your phone notifications.');
    } catch (cause) { setTestStatus(cause instanceof Error ? cause.message : 'Test failed.'); }
    finally { setTesting(false); }
  }
  return <div className="min-h-screen bg-gray-50 pb-28 text-gray-900">
    <header className="flex items-center gap-4 bg-white px-5 py-4 shadow-sm"><Link to="/customer/home" aria-label="Back"><ArrowLeft /></Link><h1 className="text-lg font-bold">Notifications</h1></header>
    <main className="space-y-4 p-5">
      <button className="rounded-xl bg-blue-600 px-4 py-3 text-white" disabled={testing} onClick={() => void testPush()}>{testing ? 'Sending…' : 'Test phone notification'}</button>
      {testStatus && <p role="status" className="text-sm">{testStatus}</p>}
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
