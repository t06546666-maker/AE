import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { CheckCircle2, Download, MessageCircle, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, queryString } from '../api';
import { ErrorState, LoadingState, PageHeader } from '../components/Common';
import type { Customer, Merchant, RewardSettings, UserProfile } from '../types';
import { formatCurrency, formatPhone, formatPoints, qrPayload } from '../utils';
import { useToast } from '../toast';

interface CreatedCustomer {
  customer: Customer;
  order: {
    order_id: string; order_no: string; created_at: string; points_earned: number;
    total_points: number; reward_percentage: number; amount: number;
  };
  notifications: {
    whatsapp: { sent?: boolean; queued?: boolean; error?: string; logId?: string; status?: WhatsAppStatus };
    email: { sent?: boolean; queued?: boolean; error?: string };
  };
}

type WhatsAppStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

interface WhatsAppMessageStatus {
  id: string;
  status: WhatsAppStatus;
  errorCode: string | null;
  error: string | null;
  updatedAt: string;
}

export function AddCustomer({ user }: { user: UserProfile }) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState('');
  const [amount, setAmount] = useState(''); const [merchantId, setMerchantId] = useState(user.merchant_id || '');
  const [percentage, setPercentage] = useState(1);
  const [result, setResult] = useState<CreatedCustomer | null>(null); const [qrUrl, setQrUrl] = useState('');
  const queryClient = useQueryClient(); const { showToast } = useToast();
  const settings = useQuery({ queryKey: ['reward-settings'], queryFn: ({ signal }) => apiFetch<RewardSettings>('/api/settings/reward', { signal }) });
  const merchants = useQuery({
    queryKey: ['merchants', 'selector'],
    queryFn: ({ signal }) => apiFetch<{ merchants: Merchant[] }>(`/api/merchants?${queryString({ page: 1, pageSize: 100 })}`, { signal }),
    enabled: user.role === 'admin',
  });

  useEffect(() => { if (settings.data) setPercentage(settings.data.rewardPercentage); }, [settings.data]);
  useEffect(() => { if (user.role === 'admin' && merchants.data?.merchants[0] && !merchantId) setMerchantId(merchants.data.merchants[0].id); }, [merchantId, merchants.data, user.role]);
  useEffect(() => {
    if (!result) return;
    QRCode.toDataURL(qrPayload(result.customer), { width: 280, margin: 2, errorCorrectionLevel: 'M' }).then(setQrUrl);
  }, [result]);

  const whatsappStatus = useQuery({
    queryKey: ['whatsapp-message', result?.notifications.whatsapp.logId],
    queryFn: ({ signal }) => apiFetch<WhatsAppMessageStatus>(
      `/api/whatsapp/messages/${result?.notifications.whatsapp.logId}`,
      { signal },
    ),
    enabled: Boolean(result?.notifications.whatsapp.logId),
    refetchInterval(query) {
      return !query.state.data || query.state.data.status === 'queued' ? 2_000 : false;
    },
  });

  const createCustomer = useMutation({
    mutationFn: () => apiFetch<CreatedCustomer>('/api/customers', {
      method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ name: name.trim(), phone: `+91${phone}`, email: email.trim(), amount: Number(amount), rewardPercentage: percentage, merchantId, location: 'In-store' }),
    }),
    onSuccess(data) {
      setResult(data); showToast(`${data.customer.name} registered successfully`);
      setName(''); setPhone(''); setEmail(''); setAmount('');
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  const resendQr = useMutation({
    mutationFn: () => apiFetch<{ whatsapp: CreatedCustomer['notifications']['whatsapp'] }>('/api/send-qr', {
      method: 'POST', body: JSON.stringify({ cid: result?.customer.id, merchantId: result?.customer.merchantId || merchantId }),
    }),
    onSuccess(data) {
      setResult((current) => current ? {
        ...current,
        notifications: { ...current.notifications, whatsapp: data.whatsapp },
      } : current);
      showToast(data.whatsapp.sent ? 'WhatsApp QR message sent' : 'WhatsApp message failed', data.whatsapp.sent ? 'success' : 'error');
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) return showToast('Enter a valid 10-digit Indian mobile number', 'error');
    if (Number(amount) < 100) return showToast('Minimum purchase amount is ₹100', 'error');
    createCustomer.mutate();
  }

  function downloadQr() {
    if (!qrUrl || !result) return;
    const anchor = document.createElement('a'); anchor.href = qrUrl; anchor.download = `AE-QR-${result.customer.id}.png`; anchor.click();
  }

  if (settings.isPending || (user.role === 'admin' && merchants.isPending)) return <><PageHeader title={user.role === 'admin' ? 'Add Customer' : 'Add Buyer'} subtitle="Register a customer and issue first-purchase points." /><LoadingState /></>;
  if (settings.isError) return <ErrorState error={settings.error} retry={() => settings.refetch()} />;
  const options = settings.data?.rewardOptions || [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const points = Number(amount) >= 100 ? Number(amount) * percentage / 100 : 0;
  const selectedMerchant = merchants.data?.merchants.find((merchant) => merchant.id === merchantId)?.name || '';
  const liveWhatsapp = whatsappStatus.data;
  const whatsappState = liveWhatsapp?.status
    || result?.notifications.whatsapp.status
    || (result?.notifications.whatsapp.sent ? 'sent' : result?.notifications.whatsapp.queued ? 'queued' : 'failed');
  const whatsappError = liveWhatsapp?.error || result?.notifications.whatsapp.error;
  return (
    <>
      <PageHeader title={user.role === 'admin' ? 'Add Customer' : 'Add Buyer'} subtitle="Register a customer, save the first order, and queue their QR message." />
      <form className="panel registration-form" onSubmit={submit}>
        <div className="panel-heading"><div><h2>New customer registration</h2><p>Email is optional.</p></div><UserPlus /></div>
        <div className="customer-fields">
          <label>Customer name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
          <label>WhatsApp number<div className="phone-field"><span>+91</span><input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" pattern="[6-9][0-9]{9}" required /></div></label>
          <label>Email address <small>Optional</small><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        </div>
        <div className="purchase-fields registration-purchase">
          <label>Purchase amount (₹)<input className="amount-input" type="number" min="100" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /><span className="amount-rule">Minimum purchase ₹100</span></label>
          <label>Reward percentage<select value={percentage} onChange={(event) => setPercentage(Number(event.target.value))}>{options.map((option) => <option key={option} value={option}>{option}%</option>)}</select></label>
          <div className="point-preview"><span>Points issued</span><strong>{formatPoints(points)} points</strong></div>
        </div>
        {user.role === 'admin' ? <label className="merchant-select">Assign to merchant<select value={merchantId} onChange={(event) => setMerchantId(event.target.value)} required>{merchants.data?.merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}</select></label> : null}
        <div className="form-actions"><button className="button primary" disabled={createCustomer.isPending}><UserPlus size={17} />{createCustomer.isPending ? 'Registering' : 'Register and send QR'}</button><Link className="button secondary" to="/orders">Cancel</Link></div>
      </form>
      {result ? (
        <section className="panel registration-result">
          <div className="panel-heading"><div><h2><CheckCircle2 /> Customer registered</h2><p>The order and reward balance are saved.</p></div></div>
          <div className="result-grid">
            <div className="result-qr">{qrUrl ? <img src={qrUrl} alt={`QR code for ${result.customer.name}`} /> : <span>Generating QR...</span>}<strong>{result.customer.id}</strong></div>
            <div className="result-details"><h3>{result.customer.name}</h3><p>{formatPhone(result.customer.phone)}</p><p>{result.customer.email}</p><dl><div><dt>Merchant</dt><dd>{result.customer.merchant || selectedMerchant}</dd></div><div><dt>Order</dt><dd>{result.order.order_no}</dd></div><div><dt>Amount</dt><dd>{formatCurrency(result.order.amount || 0)}</dd></div><div><dt>Points</dt><dd>{formatPoints(result.order.points_earned)}</dd></div></dl><div className="notification-row"><span className={`tag ${['sent', 'delivered', 'read'].includes(whatsappState) ? 'success' : whatsappState === 'failed' ? 'danger' : 'info'}`}>WhatsApp {whatsappState}</span><span className={`tag ${result.notifications.email.queued || result.notifications.email.sent ? 'success' : 'muted'}`}>Email {result.customer.email ? result.notifications.email.queued ? 'queued' : result.notifications.email.sent ? 'sent' : 'not sent' : 'not provided'}</span></div>{whatsappState === 'failed' && whatsappError ? <div className="form-error">{whatsappError}</div> : null}<div className="result-actions"><button className="button whatsapp" disabled={resendQr.isPending} onClick={() => resendQr.mutate()}><MessageCircle size={16} />{resendQr.isPending ? 'Sending' : 'Send WhatsApp'}</button><button className="button secondary" onClick={downloadQr}><Download size={16} />Download QR</button></div></div>
          </div>
        </section>
      ) : null}
    </>
  );
}
