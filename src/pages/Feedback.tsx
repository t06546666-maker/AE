import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareText, Send } from 'lucide-react';
import { apiFetch, queryString } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, PaginationBar } from '../components/Common';
import type { MerchantFeedback, Pagination, UserProfile } from '../types';
import { formatDate } from '../utils';
import { useToast } from '../toast';

type FeedbackResponse = { feedback: MerchantFeedback[]; pagination: Pagination };

export function Feedback({ user }: { user: UserProfile }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const feedback = useQuery({
    queryKey: ['feedback', page],
    queryFn: ({ signal }) => apiFetch<FeedbackResponse>(`/api/feedback?${queryString({ page, pageSize: 20 })}`, { signal }),
    placeholderData: (previous) => previous,
  });
  const send = useMutation({
    mutationFn: () => apiFetch('/api/feedback', { method: 'POST', body: JSON.stringify({ message }) }),
    onSuccess() {
      setMessage('');
      setPage(1);
      showToast('Your feedback was sent to Affiliate AE.');
      void queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return showToast('Write your feedback before sending it.', 'error');
    send.mutate();
  }

  const title = user.role === 'merchant' ? 'Feedback' : 'Merchant feedback';
  const subtitle = user.role === 'merchant'
    ? 'Tell Affiliate AE what would make your workspace better.'
    : 'Feedback submitted by merchants across Affiliate AE.';

  return <>
    <PageHeader title={title} subtitle={subtitle} />
    {user.role === 'merchant' ? <section className="panel feedback-compose-panel">
      <form className="feedback-compose" onSubmit={submit}>
        <label>Your feedback
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} required />
        </label>
        <div className="form-actions"><button className="button primary" disabled={send.isPending}><Send size={16} />{send.isPending ? 'Sending...' : 'Send feedback'}</button></div>
      </form>
    </section> : null}
    <section className="panel feedback-list-panel">
      <div className="form-heading"><div><h2>{user.role === 'merchant' ? 'Your feedback' : 'All feedback'}</h2><p>{user.role === 'merchant' ? 'Your previous messages are shown here.' : 'Messages are read-only. No reply workflow is enabled.'}</p></div><MessageSquareText size={22} /></div>
      {feedback.isPending ? <LoadingState /> : feedback.isError ? <ErrorState error={feedback.error} retry={() => feedback.refetch()} /> : !feedback.data?.feedback.length ? <EmptyState>{user.role === 'merchant' ? 'You have not sent feedback yet.' : 'No merchant feedback yet.'}</EmptyState> : <>
        <div className="feedback-list">
          {feedback.data.feedback.map((entry) => <article className="feedback-entry" key={entry.id}>
            <div className="feedback-entry-head"><strong>{user.role === 'admin' ? `${entry.merchantCode ? `${entry.merchantCode} - ` : ''}${entry.merchant}` : 'Feedback sent'}</strong><span>{formatDate(entry.createdAt)}</span></div>
            <p>{entry.message}</p>
          </article>)}
        </div>
        <PaginationBar pagination={feedback.data.pagination} onPage={setPage} />
      </>}
    </section>
  </>;
}
