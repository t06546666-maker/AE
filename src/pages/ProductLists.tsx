import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, LoadingState, PageHeader } from '../components/Common';
import { apiFetch } from '../api';

type Request = { id: string; product_list?: string; image_path?: string; status: string; created_at: string; customers?: { name?: string; phone?: string }; merchants?: { name?: string } };
export function ProductLists() {
  const queryClient = useQueryClient();
  const lists = useQuery({ queryKey: ['admin-product-lists'], queryFn: () => apiFetch<{ requests: Request[] }>('/api/product-list-requests') });
  const review = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/api/product-list-requests/${id}/review`, { method: 'PATCH', body: JSON.stringify({ status }) }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-product-lists'] }) });
  return <><PageHeader title="Product lists" subtitle="Review customer product requests before sending them to merchants." /><section className="panel">{lists.isPending ? <LoadingState /> : !lists.data?.requests.length ? <EmptyState>No product lists submitted yet.</EmptyState> : <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Merchant</th><th>Products</th><th>Sent</th><th>Status</th><th>Review</th></tr></thead><tbody>{lists.data.requests.map(item => <tr key={item.id}><td><strong>{item.customers?.name || 'Customer'}</strong><small>{item.customers?.phone || ''}</small></td><td>{item.merchants?.name || 'Merchant'}</td><td>{item.product_list || 'Photo product list'}</td><td>{new Date(item.created_at).toLocaleDateString()}</td><td><span className={`tag ${item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'info'}`}>{item.status}</span></td><td><select value={item.status} onChange={event => review.mutate({ id: item.id, status: event.target.value })}><option value="pending">pending</option><option value="approved">approved</option><option value="rejected">rejected</option></select></td></tr>)}</tbody></table></div>}</section></>;
}
