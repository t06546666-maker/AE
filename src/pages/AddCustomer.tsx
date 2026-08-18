import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { CheckCircle2, Download, MessageCircle, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

interface PhoneRegistrationStatus {
  registered: boolean;
  registeredWithMerchant: boolean;
}

export function AddCustomer({ user }: { user: UserProfile }) {
  const { t } = useTranslation();
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
  const validPhone = /^[6-9]\d{9}$/.test(phone);
  const phoneStatus = useQuery({
    queryKey: ['customer-phone-status', phone, merchantId],
    queryFn: ({ signal }) => apiFetch<PhoneRegistrationStatus>(
      `/api/customers/phone-status?${queryString({ phone: `+91${phone}`, merchantId })}`,
      { signal },
    ),
    enabled: validPhone && Boolean(merchantId),
    staleTime: 30_000,
    retry: 1,
  });

  const whatsappStatus = useQuery({
    queryKey: ['whatsapp-message', result?.notifications.whatsapp.logId],
    queryFn: ({ signal }) => apiFetch<WhatsAppMessageStatus>(
      `/api/whatsapp/messages/${result?.notifications.whatsapp.logId}`,
      { signal },
    ),
    enabled: Boolean(result?.notifications.whatsapp.logId),
    refetchInterval(query) {
      const status = query.state.data?.status;
      const registrationTime = result?.order.created_at ? new Date(result.order.created_at).getTime() : Date.now();
      const isWaitingForDelivery = !status || status === 'queued' || status === 'sent';
      return isWaitingForDelivery && Date.now() - registrationTime < 5 * 60_000 ? 2_000 : false;
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

  if (settings.isPending || (user.role === 'admin' && merchants.isPending)) return <><PageHeader title={t(user.role === 'admin' ? 'nav.addCustomer' : 'nav.addBuyer')} subtitle={t('registration.subtitle')} /><LoadingState /></>;
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
      <PageHeader title={t(user.role === 'admin' ? 'nav.addCustomer' : 'nav.addBuyer')} subtitle={t('registration.subtitle')} />
      <form className="panel registration-form" onSubmit={submit}>
        <div className="panel-heading"><div><h2>{t('registration.new')}</h2><p>{t('registration.emailOptional')}</p></div><UserPlus /></div>
        <div className="customer-fields">
          <label>{t('registration.name')}<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
          <label>{t('registration.whatsappNumber')}<div className="phone-field"><span>+91</span><input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" pattern="[6-9][0-9]{9}" required /></div>{validPhone ? <span className={`phone-registration-status ${phoneStatus.data?.registered ? 'existing' : phoneStatus.data ? 'available' : ''}`} role="status" aria-live="polite">{phoneStatus.isFetching ? t('registration.phoneChecking') : phoneStatus.isError ? t('registration.phoneCheckFailed') : phoneStatus.data?.registeredWithMerchant ? t('registration.alreadyMerchant') : phoneStatus.data?.registered ? t('registration.alreadyAffiliate') : t('registration.newAffiliate')}</span> : null}</label>
          <label>{t('registration.emailAddress')} <small>{t('registration.optional')}</small><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        </div>
        <div className="purchase-fields registration-purchase">
          <label>{t('registration.purchaseAmount')}<input className="amount-input" type="number" min="100" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /><span className="amount-rule">{t('registration.minimum')}</span></label>
          <label>{t('registration.rewardPercentage')}<select value={percentage} onChange={(event) => setPercentage(Number(event.target.value))}>{options.map((option) => <option key={option} value={option}>{option}%</option>)}</select></label>
          <div className="point-preview"><span>{t('registration.pointsIssued')}</span><strong>{formatPoints(points)} points</strong></div>
        </div>
        {user.role === 'admin' ? <label className="merchant-select">{t('registration.assignMerchant')}<select value={merchantId} onChange={(event) => setMerchantId(event.target.value)} required>{merchants.data?.merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}</select></label> : null}
        <div className="form-actions"><button className="button primary" disabled={createCustomer.isPending}><UserPlus size={17} />{t(createCustomer.isPending ? 'registration.registering' : 'registration.registerSend')}</button><Link className="button secondary" to="/orders">{t('registration.cancel')}</Link></div>
      </form>
      {result ? (
        <section className="panel registration-result">
          <div className="panel-heading"><div><h2><CheckCircle2 /> {t('registration.registered')}</h2><p>{t('registration.saved')}</p></div></div>
          <div className="result-grid">
            <div className="result-qr">{qrUrl ? <img src={qrUrl} alt={`QR code for ${result.customer.name}`} /> : <span>{t('customers.generating')}</span>}<strong>{result.customer.id}</strong></div>
            <div className="result-details"><h3>{result.customer.name}</h3><p>{formatPhone(result.customer.phone)}</p><p>{result.customer.email}</p><dl><div><dt>{t('registration.merchant')}</dt><dd>{result.customer.merchant || selectedMerchant}</dd></div><div><dt>{t('orders.order')}</dt><dd>{result.order.order_no}</dd></div><div><dt>{t('orders.amount')}</dt><dd>{formatCurrency(result.order.amount || 0)}</dd></div><div><dt>{t('orders.points')}</dt><dd>{formatPoints(result.order.points_earned)}</dd></div></dl><div className="notification-row"><span className={`tag ${['sent', 'delivered', 'read'].includes(whatsappState) ? 'success' : whatsappState === 'failed' ? 'danger' : 'info'}`}>WhatsApp {whatsappState}</span><span className={`tag ${result.notifications.email.queued || result.notifications.email.sent ? 'success' : 'muted'}`}>Email {result.customer.email ? result.notifications.email.queued ? 'queued' : result.notifications.email.sent ? 'sent' : 'not sent' : 'not provided'}</span></div>{whatsappState === 'failed' && whatsappError ? <div className="form-error">{whatsappError}</div> : null}<div className="result-actions"><button className="button whatsapp" disabled={resendQr.isPending} onClick={() => resendQr.mutate()}><MessageCircle size={16} />{resendQr.isPending ? 'Sending' : t('customers.sendWhatsapp')}</button><button className="button secondary" onClick={downloadQr}><Download size={16} />{t('registration.downloadQr')}</button></div></div>
          </div>
        </section>
      ) : null}
    </>
  );
}
