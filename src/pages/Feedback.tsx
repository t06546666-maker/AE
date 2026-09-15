import { MessageSquare, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { PageHeader } from '../components/Common';
import type { UserProfile } from '../types';

type FeedbackItem = { id: string; type: 'app' | 'merchant'; rating: number | null; message: string; createdAt: string; customerName: string; merchantName: string };

export function Feedback({ user }: { user: UserProfile }) {
  const query = useQuery({ queryKey: ['feedback'], queryFn: () => apiFetch<{ feedback: FeedbackItem[] }>('/api/feedback') });
  const items = query.data?.feedback || [];
  return <div className="dashboard-page"><PageHeader title="Feedback & Reviews" subtitle={user.role === 'admin' ? 'App feedback and merchant reviews' : 'Reviews from your customers'} />
    <div className="card" style={{ marginTop: 24, padding: 0 }}>
      {query.isLoading ? <p style={{ padding: 24 }}>Loading feedback…</p> : query.error ? <p style={{ padding: 24, color: '#b91c1c' }}>Unable to load feedback.</p> : items.length === 0 ? <p style={{ padding: 24, color: '#64748b' }}>No feedback has been submitted yet.</p> : items.map((item) => <div key={item.id} style={{ padding: 20, borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><MessageSquare size={18} color="#3b28cc" /><strong>{item.type === 'app' ? 'App feedback' : `${item.merchantName || 'Merchant'} review`}</strong>{item.rating ? <span style={{ color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: 3 }}>{item.rating}/5 <Star size={14} fill="currentColor" /></span> : null}<span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 12 }}>{new Date(item.createdAt).toLocaleString()}</span></div>
        <p style={{ margin: '10px 0 4px' }}>{item.message}</p><small style={{ color: '#64748b' }}>From {item.customerName}</small>
      </div>)}
    </div>
  </div>;
}
