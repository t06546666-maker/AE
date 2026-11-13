import {productListStatusLabel} from '../productListStatus';
import { uiText } from '../uiText';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, LoadingState, PageHeader } from '../components/Common';
import { apiFetch } from '../api';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ProductListPhotoPreview } from '../components/ProductListPhotoPreview';

type Request = { id: string; product_list?: string; image_path?: string; image_url?: string; status: string; merchant_status?: string; created_at: string; pickup_time?: string; customers?: { name?: string; phone?: string }; merchants?: { name?: string } };
export function ProductLists() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const lists = useQuery({ queryKey: ['admin-product-lists'], queryFn: () => apiFetch<{ requests: Request[] }>('/api/product-list-requests') });
  const review = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/api/product-list-requests/${id}/review`, { method: 'PATCH', body: JSON.stringify({ status }) }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-product-lists'] }) });
  const requestId = new URLSearchParams(location.search).get('requestId');
  const [photo, setPhoto] = useState<{ src: string; customerName: string } | null>(null);
  useEffect(() => {
    if (!requestId || !lists.data) return;
    document.getElementById(`product-list-${requestId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [requestId, lists.data]);
  return <><PageHeader title={uiText("Product lists")} subtitle={uiText("Review customer product requests before sending them to merchants.")} />{photo && <ProductListPhotoPreview src={photo.src} customerName={photo.customerName} onClose={() => setPhoto(null)} onReload={async () => undefined} />}<section className="panel">{lists.isPending ? <LoadingState /> : !lists.data?.requests.length ? <EmptyState>{uiText("No product lists submitted yet.")}</EmptyState> : <div className="table-scroll"><table><thead><tr><th>{uiText("Customer")}</th><th>{uiText("Merchant")}</th><th>{uiText("Products")}</th><th>{uiText("Pickup Time")}</th><th>{uiText("Sent")}</th><th>{uiText("Status")}</th><th>{uiText("Review")}</th></tr></thead><tbody>{lists.data.requests.map(item => <tr id={`product-list-${item.id}`} key={item.id} style={requestId === item.id ? { outline: '2px solid var(--primary)', outlineOffset: '-2px' } : undefined}><td><strong>{item.customers?.name || uiText('Customer')}</strong><small>{item.customers?.phone || ''}</small></td><td>{item.merchants?.name || uiText('Merchant')}</td><td>{item.product_list || (!item.image_url ? uiText('Photo product list') : '')}{item.image_url && <button type="button" className="ae-list-photo-button" aria-haspopup="dialog" onClick={() => setPhoto({ src: item.image_url!, customerName: item.customers?.name || uiText('Customer') })}><img src={item.image_url} alt={uiText('Product list photo')} loading="lazy" /><span>{uiText('View photo')}</span></button>}</td><td>{item.pickup_time ? <span className="tag success" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>🕒 {item.pickup_time}</span> : <span style={{ color: '#94a3b8' }}>—</span>}</td><td>{new Date(item.created_at).toLocaleDateString()}</td><td><span className={`tag ${item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'info'}`}>{uiText(item.merchant_status ? productListStatusLabel(item.merchant_status) : item.status)}</span></td><td><select value={item.status} disabled={Boolean(item.merchant_status) || review.isPending} onChange={event => review.mutate({ id: item.id, status: event.target.value })}><option value="pending">{uiText("pending")}</option><option value="approved">{uiText("approved")}</option><option value="rejected">{uiText("rejected")}</option></select></td></tr>)}</tbody></table></div>}</section></>;
}
