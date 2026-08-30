import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

export default function QrScanner({ settings, autoStart = false }: { settings: RewardSettings; autoStart?: boolean }) {
  const { t } = useTranslation();
  const [scanner, setScanner] = useState<ScannerInstance | null>(null);
  const [customer, setCustomer] = useState<(Customer & { isNewToMerchant?: boolean }) | null>(null);
  const [message, setMessage] = useState(() => t('scanner.secure'));
  const [starting, setStarting] = useState(false);
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState(settings.merchantEarnPoints || (settings.earnOptions?.[0] || 10));
  const locked = useRef(false);
  const scannerRef = useRef<ScannerInstance | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

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
    try { payload = JSON.parse(decoded) as { id?: string }; } catch { setMessage(t('scanner.invalid')); return; }
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
    mutationFn: () => apiFetch<{ purchase: { points_earned: number }; whatsapp: { queued?: boolean; sent?: boolean } }>('/api/checkouts', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ customerCode: customer?.id, amount: Number(amount), rewardPercentage: percentage, location: 'In-store' }),
    }),
    onSuccess(data) {
      showToast(t('scanner.checkoutSaved', { points: formatPoints(data.purchase.points_earned) }));
      setCustomer(null); setAmount(''); locked.current = false;
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  const eligibleAmount = Number(amount) < 100 ? 0 : Math.min(Number(amount), 10000);
  const points = Math.floor((eligibleAmount / 100) * percentage);
  return (
    <section className="panel scanner-panel">
      <div className="panel-heading"><div><h2>{t('scanner.title')}</h2><p>{t('scanner.subtitle')}</p></div><ScanLine /></div>
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
              <div className="purchase-fields">
                <label>{t('registration.purchaseAmount')}<input className="amount-input" type="number" min="100" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                <label>Points per ₹100<select value={percentage} onChange={(event) => setPercentage(Number(event.target.value))}>{(settings.earnOptions || [5, 10, 20, 30, 50]).map((option: number) => <option key={option} value={option}>{option} Pts</option>)}</select></label>
              </div>
              <div className="point-preview"><strong>{formatPoints(points)} points</strong></div>
              <p className="amount-rule">{t('registration.minimum')}</p>
              <button type="button" className="button primary full-button" disabled={Number(amount) < 100 || checkout.isPending} onClick={() => checkout.mutate()}>{t(checkout.isPending ? 'scanner.processing' : 'scanner.complete')}</button>
            </div>
          ) : <div className="scan-placeholder"><ScanLine size={30} /><p>{t('scanner.begin')}</p></div>}
        </div>
      </div>
    </section>
  );
}
