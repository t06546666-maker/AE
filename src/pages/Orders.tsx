import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, PaginationBar } from '../components/Common';
import type { Order, Pagination, UserProfile } from '../types';
import { formatCurrency, formatDate, formatPoints, formatTime, initials } from '../utils';

export function Orders({ user }: { user: UserProfile }) {
  const [page, setPage] = useState(1); const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  useEffect(() => setPage(1), [deferredSearch]);
  const orders = useQuery({
    queryKey: ['orders', page, deferredSearch],
    queryFn: ({ signal }) => apiFetch<{ orders: Order[]; pagination: Pagination }>(`/api/orders?${queryString({ page, pageSize: 25, search: deferredSearch })}`, { signal }),
    placeholderData: (previous) => previous,
  });
  return (
    <>
      <PageHeader title="Order List" subtitle={`${orders.data?.pagination.total || 0} orders in your accessible network.`} actions={<Link className="button primary" to="/add-customer"><Plus size={16} />{user.role === 'admin' ? 'Add customer' : 'Add buyer'}</Link>} />
      <div className="list-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search orders" /></label></div>
      {orders.isPending ? <LoadingState label="Loading orders" /> : orders.isError ? <ErrorState error={orders.error} retry={() => orders.refetch()} /> : (
        <section className="table-panel">
          <div className="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Email</th><th className="amount-column">Amount</th><th>Reward</th><th>Points</th><th>Date</th><th>Time</th><th>WhatsApp</th><th>Email status</th></tr></thead><tbody>
            {orders.data?.orders.map((order) => <tr key={order.id}>
              <td><strong className="order-number">{order.orderNo}</strong><small>{order.source}</small></td>
              <td><div className="person-cell"><span>{initials(order.customer)}</span><div><strong>{order.customer}</strong><small>{order.cid}</small></div></div></td>
              <td>{order.phone}</td><td>{order.email}</td><td className="amount-column"><span className="tag success amount-tag">{formatCurrency(order.amount)}</span></td>
              <td><span className="tag info">{order.rewardPercentage}%</span></td><td><strong className="points-text">{formatPoints(order.rewardPoints)}</strong></td>
              <td>{formatDate(order.timestamp)}</td><td>{formatTime(order.timestamp)}</td><td><span className={`tag ${['delivered', 'read'].includes(order.whatsappStatus) ? 'success' : order.whatsappStatus === 'failed' ? 'danger' : 'info'}`}>{order.whatsappStatus.replace('_', ' ')}</span></td><td>{order.emailSent ? <span className="tag success">Sent</span> : null}</td>
            </tr>)}
          </tbody></table></div>
          {!orders.data?.orders.length ? <EmptyState>No orders found.</EmptyState> : null}
          <PaginationBar pagination={orders.data?.pagination} onPage={setPage} />
        </section>
      )}
      <div className="bottom-action"><Link className="button primary" to="/add-customer"><Plus size={16} />Quick add {user.role === 'admin' ? 'customer' : 'buyer'}</Link></div>
    </>
  );
}
