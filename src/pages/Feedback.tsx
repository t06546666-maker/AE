import { uiText } from '../uiText';
import { formatDateTime } from '../utils';
import { MessageSquare, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { ErrorState, LoadingState, PageHeader } from '../components/Common';
import type { UserProfile } from '../types';

type FeedbackItem = { id: string; type: 'app' | 'merchant'; rating: number | null; message: string; createdAt: string; customerName: string; merchantName: string };

export function Feedback({ user }: { user: UserProfile }) {
  const merchantFeedback = useQuery({ queryKey: ['merchant-feedback', user.id], enabled: user.role === 'admin', queryFn: ({ signal }) => apiFetch<{ feedback: Array<{ id: string; category: string; rating: number | null; message: string; createdAt: string; merchantName: string }> }>('/api/admin/merchant-feedback', { signal }) });
  const query = useQuery({ queryKey: ['feedback', user.id, user.role, user.merchant_id], queryFn: () => apiFetch<{ feedback: FeedbackItem[] }>('/api/feedback') });
  const items = query.data?.feedback || [];
  return <div className="dashboard-page"><PageHeader title={user.role === 'merchant' ? uiText("Customer Reviews & Feedback") : uiText("Feedback & Reviews")} subtitle={user.role === 'admin' ? 'App feedback and merchant reviews' : 'Anonymous customer reviews about your store'} />
    {user.role === 'admin' && <section className="panel" style={{ marginTop: 24 }}><h2>{uiText("Merchant feedback to AE")}</h2><p>{uiText("Suggestions and app issues submitted by merchants.")}</p>{merchantFeedback.isPending ? <LoadingState/> : merchantFeedback.isError ? <ErrorState error={merchantFeedback.error} retry={() => merchantFeedback.refetch()}/> : !merchantFeedback.data.feedback.length ? <p>{uiText("No merchant feedback yet.")}</p> : merchantFeedback.data.feedback.map(item => <article key={item.id} style={{ padding: '18px 0', borderBottom: '1px solid var(--border)' }}><strong>{item.merchantName} · {item.category}</strong>{item.rating !== null && <span> · {item.rating}/5 ★</span>}<p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '10px 0' }}>{item.message}</p><small>{formatDateTime(item.createdAt)}</small></article>)}</section>}
    <div className="card" style={{ marginTop: 24, padding: 0 }}>
      {query.isLoading ? <p style={{ padding: 24 }}>{uiText("Loading feedback…")}</p> : query.error ? <p style={{ padding: 24, color: '#b91c1c' }}>{uiText("Unable to load feedback.")}</p> : items.length === 0 ? <p style={{ padding: 24, color: '#64748b' }}>{uiText("No feedback has been submitted yet.")}</p> : items.map((item) => <div key={item.id} style={{ padding: 20, borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><MessageSquare size={18} color="#3b28cc" /><strong>{item.type === 'app' ? uiText("App feedback") : `${item.merchantName || 'Merchant'} review`}</strong>{item.rating ? <span style={{ color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: 3 }}>{item.rating}/5 <Star size={14} fill="currentColor" /></span> : null}<span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 12 }}>{formatDateTime(item.createdAt)}</span></div>
        <p style={{ margin: '10px 0 4px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.message}</p><small style={{ color: '#64748b' }}>{uiText("From ")}{user.role === 'merchant' ? uiText("Anonymous") : item.customerName}</small>
      </div>)}
    </div>
  </div>;
}
