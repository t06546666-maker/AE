import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { EmptyState, ErrorState, ExportModal, LoadingState, PageHeader, PaginationBar } from '../components/Common';
import type { Order, Pagination, UserProfile } from '../types';
import { formatCurrency, formatDate, formatPoints, formatTime, initials } from '../utils';

export function Orders({ user }: { user: UserProfile }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1); const [search, setSearch] = useState('');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  useEffect(() => setPage(1), [deferredSearch]);
  const orders = useQuery({
    queryKey: ['orders', page, deferredSearch],
    queryFn: ({ signal }) => apiFetch<{ orders: Order[]; pagination: Pagination }>(`/api/orders?${queryString({ page, pageSize: 25, search: deferredSearch })}`, { signal }),
    placeholderData: (previous) => previous,
  });
  return (
    <>
      <PageHeader title={t('nav.orders')} subtitle={t('orders.subtitle', { count: orders.data?.pagination.total || 0 })} actions={<><button type="button" className="button secondary" onClick={() => setExportFormat('xlsx')}><Download size={16} />{t('dashboard.excel')}</button><button type="button" className="button secondary" onClick={() => setExportFormat('pdf')}><Download size={16} />{t('dashboard.pdf')}</button><Link className="button primary" to="/add-customer"><Plus size={16} />{t(user.role === 'admin' ? 'dashboard.addCustomer' : 'dashboard.addBuyer')}</Link></>} />
      <div className="list-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t('orders.search')} /></label></div>
      {orders.isPending ? <LoadingState label={t('common.loading')} /> : orders.isError ? <ErrorState error={orders.error} retry={() => orders.refetch()} /> : (
        <section className="table-panel">
          <div className="table-scroll"><table><thead><tr><th>{t('orders.order')}</th><th>{t('orders.customer')}</th><th>{t('orders.phone')}</th><th>{t('layout.email')}</th><th className="amount-column">{t('orders.amount')}</th><th>{t('orders.reward')}</th><th>{t('orders.points')}</th><th>{t('orders.date')}</th><th>{t('orders.time')}</th><th>{t('layout.whatsapp')}</th><th>{t('orders.emailStatus')}</th></tr></thead><tbody>
            {orders.data?.orders.map((order) => <tr key={order.id}>
              <td><strong className="order-number">{order.orderNo}</strong><small>{order.source}</small></td>
              <td><div className="person-cell"><span>{initials(order.customer)}</span><div><strong>{order.customer}</strong><small>{order.cid}</small></div></div></td>
              <td>{order.phone}</td><td>{order.email}</td><td className="amount-column"><span className="tag success amount-tag">{formatCurrency(order.amount)}</span></td>
              <td><span className="tag info">{order.rewardPercentage}%</span></td><td><strong className="points-text">{formatPoints(order.rewardPoints)}</strong></td>
              <td>{formatDate(order.timestamp)}</td><td>{formatTime(order.timestamp)}</td><td><span className={`tag ${['delivered', 'read'].includes(order.whatsappStatus) ? 'success' : order.whatsappStatus === 'failed' ? 'danger' : 'info'}`}>{order.whatsappStatus.replace('_', ' ')}</span></td><td>{order.emailSent ? <span className="tag success">{t('orders.sent')}</span> : null}</td>
            </tr>)}
          </tbody></table></div>
          {!orders.data?.orders.length ? <EmptyState>{t('orders.noOrders')}</EmptyState> : null}
          <PaginationBar pagination={orders.data?.pagination} onPage={setPage} />
        </section>
      )}
      <div className="bottom-action"><Link className="button primary" to="/add-customer"><Plus size={16} />{t('orders.quickAdd')} {t(user.role === 'admin' ? 'dashboard.addCustomer' : 'dashboard.addBuyer')}</Link></div>
      <ExportModal open={Boolean(exportFormat)} format={exportFormat || 'xlsx'} isAdmin={user.role === 'admin'} defaultSection="orders" fixedSection onClose={() => setExportFormat(null)} />
    </>
  );
}
