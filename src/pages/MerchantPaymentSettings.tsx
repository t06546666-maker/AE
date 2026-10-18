import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, CreditCard, ExternalLink } from 'lucide-react';
import { apiFetch } from '../api';
import { ErrorState, LoadingState, PageHeader } from '../components/Common';
import type { UserProfile } from '../types';
import { uiText } from '../uiText';
import { useToast } from '../toast';

type PaymentSettingsResponse = {
  success: boolean;
  data: { upiId?: string; displayName?: string; paymentEnabled?: boolean };
};

export function MerchantPaymentSettings({ user, onBack }: { user: UserProfile; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const settings = useQuery({
    queryKey: ['merchant-payment-settings', user.merchant_id],
    queryFn: ({ signal }) => apiFetch<PaymentSettingsResponse>(`/api/merchants/${encodeURIComponent(user.merchant_id || '')}/payment-settings`, { signal }),
    enabled: Boolean(user.merchant_id),
  });
  const [form, setForm] = useState({ upiId: '', displayName: '', paymentEnabled: false });

  useEffect(() => {
    if (!settings.data?.data) return;
    const { upiId, displayName, paymentEnabled } = settings.data.data;
    setForm({ upiId: upiId || '', displayName: displayName || '', paymentEnabled: Boolean(paymentEnabled) });
  }, [settings.data]);

  const saveSettings = useMutation({
    mutationFn: () => apiFetch(`/api/merchants/${encodeURIComponent(user.merchant_id || '')}/payment-settings`, {
      method: 'PATCH',
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['merchant-payment-settings', user.merchant_id] });
      showToast(uiText('UPI settings saved.'));
    },
    onError: (error: Error) => showToast(error.message, 'error'),
  });

  const paymentLink = form.upiId
    ? `upi://pay?pa=${encodeURIComponent(form.upiId)}&pn=${encodeURIComponent(form.displayName || 'AE Merchant')}&cu=INR`
    : '';

  if (!user.merchant_id) return <section className="panel"><p>{uiText('No merchant account is linked to this login.')}</p><button className="button secondary" onClick={onBack}>{uiText('Back to More')}</button></section>;
  if (settings.isPending) return <LoadingState />;
  if (settings.isError) return <ErrorState error={settings.error} retry={() => void settings.refetch()} />;

  return <div style={{ maxWidth: 850, margin: 'auto', paddingBottom: 90 }}>
    <button type="button" onClick={onBack} className="button secondary"><ArrowLeft size={17} />{uiText('Back to More')}</button>
    <PageHeader title={uiText('UPI Settings')} subtitle={uiText('Manage your UPI ID and customer payment link.')} />
    <section className="panel">
      <div className="panel-heading">
        <div><h2>{uiText('Payment details')}</h2><p>{uiText('Customers can use this UPI ID to pay your shop directly.')}</p></div>
        <CreditCard />
      </div>
      <div className="form-grid">
        <label>{uiText('UPI ID')}<input autoComplete="off" value={form.upiId} onChange={event => setForm({ ...form, upiId: event.target.value.trim() })} placeholder={uiText('yourname@bank')} /></label>
        <label>{uiText('Display name')}<input autoComplete="organization" value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} placeholder={uiText('Shop or account name')} /></label>
      </div>
      <label className="checkbox-row" style={{ marginTop: 14 }}><input type="checkbox" checked={form.paymentEnabled} onChange={event => setForm({ ...form, paymentEnabled: event.target.checked })} />{uiText('Enable UPI payment requests')}</label>
      {paymentLink && <div style={{ marginTop: 20 }}>
        <label>{uiText('Your UPI payment link')}<input readOnly value={paymentLink} /></label>
        <a className="button secondary" href={paymentLink} style={{ marginTop: 10, overflowWrap: 'anywhere' }}><ExternalLink size={16} />{uiText('Open UPI app')}</a>
        <button className="button secondary" type="button" style={{ marginTop: 10, marginLeft: 8 }} onClick={() => { void navigator.clipboard.writeText(paymentLink).then(() => showToast(uiText('UPI link copied.'))).catch(() => showToast(uiText('Could not copy the UPI link.'), 'error')); }}><Copy size={16} />{uiText('Copy link')}</button>
      </div>}
      <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, marginTop: 18 }}>{uiText('Customers pay you directly in their UPI app. Check your bank or UPI app for the payment; AE does not verify transfers automatically. Never share your UPI PIN or OTP.')}</p>
      <button className="button primary" disabled={saveSettings.isPending || (form.paymentEnabled && !/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/i.test(form.upiId))} onClick={() => saveSettings.mutate()}>{saveSettings.isPending ? uiText('Saving…') : uiText('Save UPI settings')}</button>
    </section>
  </div>;
}
