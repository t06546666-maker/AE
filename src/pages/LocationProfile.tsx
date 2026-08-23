import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/Common';
import type { Merchant, Pagination } from '../types';
import { formatDate } from '../utils';

interface Network {
  id: string;
  code: string;
  name: string;
  currency: string;
  reward_rate_bps: number;
  min_redemption_threshold_paise: number;
  created_at: string;
}

export function LocationProfile() {
  const { id } = useParams();
  const { t } = useTranslation();

  const networkQuery = useQuery({
    queryKey: ['networks', id],
    queryFn: ({ signal }) => apiFetch<Network>(`/api/networks/${encodeURIComponent(id || '')}`, { signal }),
    enabled: Boolean(id),
  });

  const merchantsQuery = useQuery({
    queryKey: ['merchants', 'network', id],
    queryFn: ({ signal }) => apiFetch<{ merchants: Merchant[]; pagination: Pagination }>(
      `/api/merchants?networkId=${encodeURIComponent(id || '')}&pageSize=100`,
      { signal }
    ),
    enabled: Boolean(id),
  });

  if (networkQuery.isPending) return <LoadingState />;
  if (networkQuery.isError) return <ErrorState error={networkQuery.error} retry={() => networkQuery.refetch()} />;
  if (!networkQuery.data) return null;

  const network = networkQuery.data;

  return (
    <>
      <div className="profile-header">
        <Link to="/locations" className="button secondary">
          <ArrowLeft size={16} /> Back to Locations
        </Link>
      </div>

      <PageHeader
        title={`${network.name} (${network.code})`}
        subtitle={`Managed location since ${formatDate(network.created_at)}.`}
        actions={
          <div className="tag-group">
            <span className="tag blue"><MapPin size={12} /> {network.code}</span>
          </div>
        }
      />

      <h3>Assigned Merchants</h3>
      {merchantsQuery.isPending ? (
        <LoadingState label="Loading assigned merchants..." />
      ) : merchantsQuery.isError ? (
        <ErrorState error={merchantsQuery.error} retry={() => merchantsQuery.refetch()} />
      ) : (
        <section className="table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('merchants.code')}</th>
                  <th>{t('merchants.storeName')}</th>
                  <th>{t('login.email')}</th>
                  <th>{t('merchants.phone')}</th>
                  <th>{t('merchants.joined')}</th>
                  <th>{t('dashboard.orders')}</th>
                </tr>
              </thead>
              <tbody>
                {merchantsQuery.data?.merchants.map((merchant) => (
                  <tr key={merchant.id}>
                    <td><strong><Link to={`/merchants/${merchant.id}`}>{merchant.merchantCode}</Link></strong></td>
                    <td>{merchant.name}</td>
                    <td>{merchant.email}</td>
                    <td>{merchant.phone}</td>
                    <td>{formatDate(merchant.joined)}</td>
                    <td>{merchant.summary?.totalOrders ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!merchantsQuery.data?.merchants.length ? (
            <EmptyState>No merchants assigned to this location yet.</EmptyState>
          ) : null}
        </section>
      )}
    </>
  );
}
