import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { uiText } from '../uiText';

type Content = { version: number; updatedAt: string; sections: unknown[]; banners: Array<Record<string, unknown>>; pageText: Record<string, unknown> };

export function AdminCustomerUi() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin-customer-home-content'], queryFn: () => apiFetch<{ content: Content }>('/api/admin/customer-home-content') });
  const [draft, setDraft] = useState('');
  const save = useMutation({
    mutationFn: (content: Content) => apiFetch('/api/admin/customer-home-content', { method: 'PUT', body: JSON.stringify(content) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['admin-customer-home-content'] }),
  });
  const content = query.data?.content;
  const value = draft || (content ? JSON.stringify(content.pageText, null, 2) : '');
  return <main className="dashboard-page">
    <div className="page-heading"><div><h1>{uiText('Customer UI Editor')}</h1><p>{uiText('Edit customer-facing text and content settings. Banner images remain in Ad Banners.')}</p></div></div>
    <section className="panel">
      {query.isPending ? <p>{uiText('Loading…')}</p> : query.isError ? <p role="alert">{uiText('Customer UI settings are unavailable.')}</p> : <>
        <label>{uiText('Customer home text settings')}<textarea rows={18} value={value} onChange={event => setDraft(event.target.value)} placeholder="{}" /></label>
        <p className="admin-data-note">{uiText('Use valid JSON for page text. Changes are saved to the live customer-home configuration.')}</p>
        {save.isError && <p role="alert" className="form-error">{save.error.message}</p>}
        <button type="button" className="button primary" disabled={save.isPending || !content} onClick={() => { try { const pageText = JSON.parse(value || '{}'); save.mutate({ ...content!, pageText }); } catch { window.alert(uiText('Enter valid JSON before saving.')); } }}>{save.isPending ? uiText('Saving…') : uiText('Save customer UI')}</button>
      </>}
    </section>
  </main>;
}
