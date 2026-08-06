import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, MessageCircleMore, Search } from 'lucide-react';
import { apiFetch, queryString } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, PaginationBar } from '../components/Common';
import type { CustomerOrder, CustomerOrderStatus, Pagination, UserProfile } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useToast } from '../toast';

type CustomerOrdersResponse = { orders: CustomerOrder[]; pagination: Pagination };
const statuses: CustomerOrderStatus[] = ['pending', 'accepted', 'rejected', 'completed', 'cancelled'];

export function CustomerOrders({ user }: { user: UserProfile }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  useEffect(() => setPage(1), [deferredSearch, status]);
  const orders = useQuery({
    queryKey: ['customer-orders', page, deferredSearch, status],
    queryFn: ({ signal }) => apiFetch<CustomerOrdersResponse>(`/api/customer-orders?${queryString({ page, pageSize: 15, search: deferredSearch, status })}`, { signal }),
    placeholderData: (previous) => previous,
    refetchInterval: 15_000,
  });
  const updateStatus = useMutation({
    mutationFn: ({ order, nextStatus }: { order: CustomerOrder; nextStatus: CustomerOrderStatus }) => apiFetch(`/api/customer-orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }),
    onSuccess() { showToast('Customer order updated. The customer will be notified on WhatsApp.'); void queryClient.invalidateQueries({ queryKey: ['customer-orders'] }); void queryClient.invalidateQueries({ queryKey: ['notifications'] }); },
    onError(error) { showToast(error.message, 'error'); },
  });

  return <>
    <PageHeader title="Customer orders" subtitle="Orders customers request through Affiliate AE WhatsApp." />
    <section className="panel">
      <div className="list-toolbar customer-order-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search customer orders" /></label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
      {orders.isPending ? <LoadingState /> : orders.isError ? <ErrorState error={orders.error} retry={() => orders.refetch()} /> : !orders.data?.orders.length ? <EmptyState>No WhatsApp customer orders yet.</EmptyState> : <>
        <div className="table-scroll"><table className="customer-orders-table"><thead><tr><th>Request</th><th>Customer</th><th>Order details</th><th>Amount</th><th>Status</th><th>Received</th><th>Update</th></tr></thead><tbody>
          {orders.data.orders.map((order) => <tr key={order.id}><td><strong className="order-number">{order.requestNo}</strong></td><td><strong>{order.customer}</strong><small className="customer-order-phone">{order.customerPhone}</small></td><td className="customer-order-detail">{order.images.length ? <div className="customer-order-images">{order.images.map((image) => <a key={image.id} href={image.url} target="_blank" rel="noreferrer" title={image.caption || 'Open customer photo'}><img src={image.url} alt={image.caption || 'Customer shopping-list photo'} /></a>)}</div> : <div className="customer-order-items">{order.items.map((item) => <span key={item.id}>{item.type === 'custom' ? item.name : `${item.quantity} x ${item.name}`}</span>)}</div>}</td><td className="amount-column">{order.total === null ? <span className="tag muted">Quote needed</span> : <strong>{formatCurrency(order.total)}</strong>}</td><td><span className={`tag ${order.status === 'completed' || order.status === 'accepted' ? 'success' : order.status === 'rejected' || order.status === 'cancelled' ? 'danger' : 'info'}`}>{order.status}</span></td><td>{formatDate(order.createdAt)}</td><td><select aria-label={`Update ${order.requestNo}`} value={order.status} disabled={updateStatus.isPending} onChange={(event) => updateStatus.mutate({ order, nextStatus: event.target.value as CustomerOrderStatus })}>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></td></tr>)}
        </tbody></table></div>
        <PaginationBar pagination={orders.data.pagination} onPage={setPage} />
      </>}
    </section>
    {user.role === 'merchant' ? <section className="customer-order-help"><MessageCircleMore size={18} /><span>New WhatsApp orders appear here automatically. Updating a request sends the customer a status message.</span><CheckCheck size={18} /></section> : null}
  </>;
}
