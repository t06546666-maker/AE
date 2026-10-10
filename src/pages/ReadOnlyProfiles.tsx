import { uiText } from '../uiText';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from '../components/Common';
import { AdminForceCloseVisit } from '../components/AdminForceCloseVisit';
import { AdminManagerOverview } from '../components/AdminManagerOverview';
import { AdminFieldHistory } from '../components/AdminFieldHistory';

function Records({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  return <section className="panel"><h2>{title}</h2>{!rows.length ? <p>{uiText("No records.")}</p> : <div className="table-scroll"><table><thead><tr>{columns.map(c => <th key={c}>{c.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id || index)}>{columns.map(c => <td key={c} style={{ maxWidth: 350, overflowWrap: 'anywhere' }}>{row[c] == null ? '—' : typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c])}</td>)}</tr>)}</tbody></table></div>}</section>;
}
export function ReadOnlyProfiles({ kind }: { kind: 'manager' | 'merchant' | 'field-merchant' }) {
  const { id = '' } = useParams();
  const endpoint = kind === 'manager' ? `/api/admin/field-managers/${id}/profile` : kind === 'field-merchant' ? `/api/field/merchants/${id}/profile` : `/api/merchants/${id}/summary`;
  const query = useQuery({ queryKey: ['read-profile', kind, id], queryFn: () => apiFetch<Record<string, any>>(endpoint), refetchOnWindowFocus: kind !== 'field-merchant', staleTime: kind === 'field-merchant' ? Infinity : 0 });
  const records = useQuery({ queryKey: ['read-merchant-records', id], queryFn: () => apiFetch<Record<string, any>>(`/api/admin/merchants/${id}/records`), enabled: kind === 'merchant' });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  if (kind === 'manager') return <><AdminManagerOverview data={data} /><AdminFieldHistory id={id} /></>;
  return <div className="dashboard-page"><Link to={kind === 'field-merchant' ? '/field?section=directory' : '/merchants'}>{uiText("← Back")}</Link><h1>{uiText("Merchant Profile")}</h1><p>{uiText("Profile details are read-only · Full authorised contact details · Latest 200 records per activity category.")}</p><Records title={uiText("Profile")} rows={[data.profile || data.merchant]} />{data.summary && <Records title={uiText("Dashboard Summary")} rows={[data.summary]} />}{data.customers && <Records title={uiText("Customers and Rewards")} rows={data.customers} />}{kind === 'field-merchant' && data.activityRecorded === false && <p role="alert">{uiText("Profile loaded, but activity logging is unavailable. Admin must apply the activity migration.")}</p>}{kind === 'merchant' && (records.isPending ? <LoadingState /> : records.isError ? <ErrorState error={records.error} retry={() => void records.refetch()} /> : <><Records title={uiText("Transactions")} rows={records.data.orders || []} /><Records title={uiText("Payments")} rows={records.data.payments || []} /></>)}</div>;
}
