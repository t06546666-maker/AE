import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CheckCircle2, RefreshCw, ScanLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { apiFetch } from '../api';
import type { Customer, RewardSettings } from '../types';
import { formatPhone, formatPoints } from '../utils';
import { useToast } from '../toast';

type ScannerInstance = { start: (...args: unknown[]) => Promise<unknown>; stop: () => Promise<unknown>; clear: () => void };

function cameraErrorMessage(cause: unknown, t: TFunction) {
  const message = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause || '');
  const normalized = message.toLowerCase();

  if (normalized.includes('notallowed') || normalized.includes('permission') || normalized.includes('denied')) {
    return t('scanner.permission');
  }
  if (normalized.includes('notfound') || normalized.includes('requested device not found') || normalized.includes('no cameras')) {
    return t('scanner.notFound');
  }
  if (normalized.includes('notreadable') || normalized.includes('could not start video') || normalized.includes('trackstarterror')) {
    return t('scanner.busy');
  }
  return message || t('scanner.failed');
}

export default function QrScanner({ settings, autoStart = false, mode = 'earn', merchantId }: { settings: RewardSettings; autoStart?: boolean; mode?: 'earn' | 'redeem'; merchantId?: string; }) {
  const { t } = useTranslation();
  const [scanner, setScanner] = useState<ScannerInstance | null>(null);
  const [customer, setCustomer] = useState<(Customer & { isNewToMerchant?: boolean }) | null>(null);
  const [message, setMessage] = useState(() => t('scanner.secure'));
  const [starting, setStarting] = useState(false);
  const [amount, setAmount] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [redeemResult, setRedeemResult] = useState<{discountAmount: number; newBalance: number} | null>(null);
  const [transactionMode, setTransactionMode] = useState<'earn' | 'redeem' | 'combined'>(mode);
  const [paymentTransactionId, setPaymentTransactionId] = useState('');
  const paymentBusy = useRef(false);

  const [percentage, setPercentage] = useState(settings.merchantEarnPoints || (settings.earnOptions?.[0] || 10));
  const locked = useRef(false);
  const scannerRef = useRef<ScannerInstance | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const paymentSettings = useQuery({
    queryKey: ['merchant-payment-settings', merchantId],
    queryFn: ({ signal }) => apiFetch<{ data: { paymentEnabled: boolean; upiId: string; displayName: string; mode: 'test' | 'live' } }>(`/api/merchants/${merchantId}/payment-settings`, { signal }),
    enabled: Boolean(merchantId),
  });

  async function stopCamera(instance = scannerRef.current) {
    if (!instance) return;
    try { await instance.stop(); } catch { /* camera may already be stopped */ }
    try { instance.clear(); } catch { /* reader was already removed */ }
    if (scannerRef.current === instance) {
      scannerRef.current = null;
      setScanner(null);
    }
  }

  useEffect(() => () => {
    const activeScanner = scannerRef.current;
    scannerRef.current = null;
    if (activeScanner) {
      void activeScanner.stop().catch(() => undefined).finally(() => {
        try { activeScanner.clear(); } catch { /* reader was already removed */ }
      });
    }
  }, []);

  async function handleDecoded(decoded: string, instance: ScannerInstance) {
    if (locked.current) return;
    let payload: { id?: string };
    try {
      payload = JSON.parse(decoded) as { id?: string };
    } catch {
      // Customer QR screens use the compact customer ID directly. Accept
      // that legacy/plain format as well as the JSON payload used by the
      // merchant-generated QR codes.
      const plainId = decoded.trim();
      if (!plainId) { setMessage(t('scanner.invalid')); return; }
      payload = { id: plainId };
    }
    if (!payload.id) { setMessage(t('scanner.missingId')); return; }
    locked.current = true;
    setMessage(t('scanner.verifying'));
    try {
      const [data] = await Promise.all([
        apiFetch<{ customer: Customer & { isNewToMerchant?: boolean } }>(`/api/customers/scan/${encodeURIComponent(payload.id)}`),
        stopCamera(instance),
      ]);
      setCustomer(data.customer);
      setMessage(t('scanner.verified'));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t('scanner.customerFailed'));
      locked.current = false;
    }
  }

  async function startCamera() {
    if (starting || scanner) return;
    setStarting(true); setCustomer(null); locked.current = false; setMessage(`${t('scanner.starting')}...`);
    let instance: ScannerInstance | null = null;
    try {
      if (!window.isSecureContext) throw new Error(t('scanner.secureError'));
      if (!navigator.mediaDevices?.getUserMedia) throw new Error(t('scanner.unsupported'));

      // Explicitly ask for camera permission first to ensure the prompt appears
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        throw new Error(t('scanner.permission'));
      }

      instance = new Html5Qrcode('react-qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      }) as unknown as ScannerInstance;
      const activeInstance = instance;
      scannerRef.current = activeInstance;
      setScanner(activeInstance);
      await activeInstance.start(
        { facingMode: 'environment' },
        {
          fps: 18,
          qrbox: (width: number, height: number) => {
            const size = Math.floor(Math.min(width, height) * 0.76);
            return { width: size, height: size };
          },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decoded: string) => { void handleDecoded(decoded, activeInstance); },
        () => undefined,
      );
      setMessage(t('scanner.pointCamera'));
    } catch (cause) {
      if (instance) {
        try { await instance.stop(); } catch { /* camera did not finish starting */ }
        try { instance.clear(); } catch { /* reader was already removed */ }
      }
      if (scannerRef.current === instance) scannerRef.current = null;
      setScanner(null);
      setMessage(cameraErrorMessage(cause, t));
    } finally { setStarting(false); }
  }

  useEffect(() => {
    if (!autoStart) return undefined;
    const timer = window.setTimeout(() => { void startCamera(); }, 150);
    return () => window.clearTimeout(timer);
  }, [autoStart]);

  const checkout = useMutation({
    mutationFn: (verifiedPaymentId?: string) => apiFetch<{ purchase: { points_earned: number }; whatsapp: { queued?: boolean; sent?: boolean } }>('/api/checkouts', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ customerCode: customer?.id, amount: Number(amount), rewardPercentage: percentage, pointsToRedeem: transactionMode === 'combined' ? Number(pointsToRedeem || 0) : 0, paymentTransactionId: verifiedPaymentId || paymentTransactionId || undefined, location: 'In-store' }),
    }),
    onSuccess(data) {
      showToast(t('scanner.checkoutSaved', { points: formatPoints(data.purchase.points_earned) }));
      setCustomer(null); setAmount(''); locked.current = false;
      setPaymentTransactionId('');
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  async function payAndCheckout() {
    if (paymentBusy.current) return;
    if (!paymentSettings.data?.data?.paymentEnabled) { checkout.mutate(undefined); return; }
    if (!merchantId || !customer || !Number(amount)) return;
    paymentBusy.current = true;
    try {
      if (paymentTransactionId) {
        if (!window.confirm('Confirm only after checking that this payment arrived in your bank or UPI account. Has it arrived?')) return;
        await apiFetch('/api/payments/confirm-upi', { method: 'POST', body: JSON.stringify({ paymentId: paymentTransactionId }) });
        checkout.mutate(paymentTransactionId);
        return;
      }
      const discount = transactionMode === 'combined' && Number(pointsToRedeem || 0) > 0 ? (Number(amount) * ((Number(pointsToRedeem || 0) / 100) * Number(settings.merchantRedeemDiscount || 5)) / 100) : 0;
      const finalAmount = Math.max(0, Number(amount) - discount);
      const created = await apiFetch<{ payment: { id: string }; upiUrl: string }>('/api/payments/create-upi-intent', { method: 'POST', body: JSON.stringify({ amount: finalAmount, customer_id: customer.id }) });
      setPaymentTransactionId(created.payment.id);
      showToast('Payment request sent. The customer can open it on their AE home screen.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not start payment.', 'error'); }
    finally { paymentBusy.current = false; }
  }

  const eligibleAmount = Number(amount);
  const points = eligibleAmount < 10 ? 0 : eligibleAmount < 50 ? 2 : eligibleAmount < 100 ? 5 : Math.min(100, Math.floor(eligibleAmount / 100) * 10);

  const redeem = useMutation({
    mutationFn: () => apiFetch<{ discountAmount: number; newBalance: number }>(`/api/merchants/${merchantId}/redeem`, {
      method: 'POST',
      body: JSON.stringify({
        customerCode: customer?.id,
        transactionAmount: Number(amount),
        pointsToRedeem: Number(pointsToRedeem),
      })
    }),
    onSuccess(data) {
      setRedeemResult(data);
      showToast('Redemption successful!', 'success');
      setAmount(''); setPointsToRedeem(''); locked.current = false;
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  return (
    <section className="panel scanner-panel">
      <div className="panel-heading"><div><h2>{mode === 'redeem' ? 'Redeem Points' : t('scanner.title')}</h2><p>{mode === 'redeem' ? 'Scan customer QR to apply discount' : t('scanner.subtitle')}</p></div><ScanLine /></div>
      <div className="scanner-grid">
        <div>
          <div className="scanner-view">
            <div className="qr-reader-host" id="react-qr-reader" />
            {!scanner ? <div className="camera-off"><Camera size={30} /><span>{t('scanner.cameraOff')}</span></div> : null}
          </div>
          <div className="scanner-actions">
            <button type="button" className="button primary" disabled={starting || Boolean(scanner)} onClick={startCamera}><ScanLine size={17} />{t(starting ? 'scanner.starting' : 'scanner.scan')}</button>
            {!scanner && !customer && locked.current ? <button type="button" className="icon-button" title={t('scanner.scanAgain')} onClick={() => { locked.current = false; setMessage(t('scanner.ready')); }}><RefreshCw /></button> : null}
          </div>
          <p className="scanner-message">{message}</p>
        </div>
        <div className="checkout-panel">
          {customer ? (
            <div className="verified-customer">
              <div className="verified-title"><CheckCircle2 /><div><h3>{customer.name}</h3><p>{formatPhone(customer.phone)} · {customer.id}</p></div></div>
              {customer.isNewToMerchant ? <span className="tag info">{t('scanner.newConnection')}</span> : null}
              <p className="balance-line">{t('scanner.currentBalance')} <strong>{formatPoints(customer.rewardPoints)} points</strong></p>
              <label className="scanner-mode-field">Transaction type
                <select value={transactionMode} onChange={(event) => { setTransactionMode(event.target.value as 'earn' | 'redeem' | 'combined'); setRedeemResult(null); }}>
                  <option value="earn">Issue points</option>
                  <option value="redeem">Redeem points</option>
                  <option value="combined">Both: redeem + issue points</option>
                </select>
              </label>
              {redeemResult ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ margin: '0 0 8px' }}>Redemption Successful</h3>
                  <div style={{ background: 'var(--bg-inset)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Discount:</span><strong style={{ color: 'var(--success)' }}>₹{redeemResult.discountAmount.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Remaining pts:</span><strong>{redeemResult.newBalance} pts</strong>
                    </div>
                  </div>
                  <button type="button" className="button primary full-button" onClick={() => { setRedeemResult(null); setCustomer(null); }}>Done</button>
                </div>
              ) : transactionMode === 'redeem' ? (
                <>
                  <div className="purchase-fields">
                    <label>Transaction Amount (₹)<input className="amount-input" type="number" min="100" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                    <label>Points to Redeem (fixed)<input className="amount-input" type="number" min="100" max="100" value={pointsToRedeem} onChange={(event) => setPointsToRedeem(event.target.value)} /></label>
                  </div>
                  <p className="amount-rule" style={{marginBottom: 10}}>Available: {formatPoints(customer.rewardPoints)} pts · 100 pts = ₹{formatPoints((Number(amount || 0) / 100) * (Number(pointsToRedeem || 0) / 100) * Number(settings.merchantRedeemDiscount || 5))} discount</p>
                  <button type="button" className="button primary full-button" disabled={Number(amount) < 100 || Number(pointsToRedeem) < 100 || redeem.isPending} onClick={() => redeem.mutate()}>{redeem.isPending ? 'Processing...' : 'Calculate & Redeem'}</button>
                </>
              ) : (
                <>
                  <div className="purchase-fields">
                    <label>{t('registration.purchaseAmount')}<input className="amount-input" type="number" min="100" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                    <label>Points per INR 100<select value={percentage} onChange={(event) => setPercentage(Number(event.target.value))}>{(settings.earnOptions || [5, 10, 20, 30, 50]).filter((option: number) => option >= 1 && option <= 100).map((option: number) => <option key={option} value={option}>{option} pts</option>)}</select></label>
                    {transactionMode === 'combined' ? <label>Points to Redeem<input className="amount-input" type="number" min="100" max="100" value={pointsToRedeem} onChange={(event) => setPointsToRedeem(event.target.value)} /></label> : null}
                  </div>
                  <div className="point-preview"><strong>{formatPoints(points)} points</strong></div>
                  <p className="amount-rule">INR 10-49: 2 pts · INR 50-99: 5 pts · INR 100+: selected rate per INR 100 · Maximum 100 pts</p>
                  <button type="button" className="button primary full-button" disabled={Number(amount) < 100 || (transactionMode === 'combined' && Number(pointsToRedeem) < 100) || checkout.isPending} onClick={() => void payAndCheckout()}>{paymentSettings.data?.data?.paymentEnabled ? paymentTransactionId ? 'Confirm payment received & complete' : 'Send payment request to customer' : transactionMode === 'combined' ? 'Complete Purchase, Redeem & Issue Points' : t(checkout.isPending ? 'scanner.processing' : 'scanner.complete')}</button>
                </>
              )}
            </div>
          ) : <div className="scan-placeholder"><ScanLine size={30} /><p>{t('scanner.begin')}</p></div>}
        </div>
      </div>
    </section>
  );
}
