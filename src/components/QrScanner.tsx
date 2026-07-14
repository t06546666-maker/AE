import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, RefreshCw, ScanLine } from 'lucide-react';
import { apiFetch } from '../api';
import type { Customer, RewardSettings } from '../types';
import { formatPhone, formatPoints } from '../utils';
import { useToast } from '../toast';

type ScannerInstance = { start: (...args: unknown[]) => Promise<unknown>; stop: () => Promise<unknown>; clear: () => void };

export default function QrScanner({ settings }: { settings: RewardSettings }) {
  const [scanner, setScanner] = useState<ScannerInstance | null>(null);
  const [customer, setCustomer] = useState<(Customer & { isNewToMerchant?: boolean }) | null>(null);
  const [message, setMessage] = useState('Camera access requires HTTPS or localhost.');
  const [starting, setStarting] = useState(false);
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState(settings.rewardPercentage);
  const locked = useRef(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  async function stopCamera(instance = scanner) {
    if (!instance) return;
    try { await instance.stop(); } catch { /* camera may already be stopped */ }
    try { instance.clear(); } catch { /* reader was already removed */ }
    setScanner(null);
  }

  useEffect(() => () => { void stopCamera(scanner); }, [scanner]);

  async function handleDecoded(decoded: string, instance: ScannerInstance) {
    if (locked.current) return;
    let payload: { id?: string };
    try { payload = JSON.parse(decoded) as { id?: string }; } catch { setMessage('Invalid Affiliate AE QR code.'); return; }
    if (!payload.id) { setMessage('Customer ID is missing from this QR code.'); return; }
    locked.current = true;
    setMessage('QR found. Verifying customer...');
    try {
      const [data] = await Promise.all([
        apiFetch<{ customer: Customer & { isNewToMerchant?: boolean } }>(`/api/customers/scan/${encodeURIComponent(payload.id)}`),
        stopCamera(instance),
      ]);
      setCustomer(data.customer);
      setMessage('Customer verified.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Customer could not be verified.');
      locked.current = false;
    }
  }

  async function startCamera() {
    if (starting || scanner) return;
    setStarting(true); setCustomer(null); locked.current = false; setMessage('Starting camera...');
    try {
      const library = await import('html5-qrcode');
      const instance = new library.Html5Qrcode('react-qr-reader', {
        formatsToSupport: [library.Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      }) as unknown as ScannerInstance;
      setScanner(instance);
      await instance.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (width: number, height: number) => {
            const size = Math.floor(Math.min(width, height) * 0.72);
            return { width: size, height: size };
          },
          aspectRatio: 1,
          disableFlip: true,
        },
        (decoded: string) => { void handleDecoded(decoded, instance); },
        () => undefined,
      );
      setMessage('Point the camera at the customer QR code.');
    } catch (cause) {
      setScanner(null);
      setMessage(cause instanceof Error ? cause.message : 'Camera permission was denied.');
    } finally { setStarting(false); }
  }

  const checkout = useMutation({
    mutationFn: () => apiFetch<{ purchase: { points_earned: number }; whatsapp: { queued?: boolean; sent?: boolean } }>('/api/checkouts', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ customerCode: customer?.id, amount: Number(amount), rewardPercentage: percentage, location: 'In-store' }),
    }),
    onSuccess(data) {
      showToast(`Checkout saved · ${formatPoints(data.purchase.points_earned)} points issued`);
      setCustomer(null); setAmount(''); locked.current = false;
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  const points = Number(amount) >= 100 ? Number(amount) * percentage / 100 : 0;
  return (
    <section className="panel scanner-panel">
      <div className="panel-heading"><div><h2>Scan customer QR</h2><p>Identify a customer and complete checkout.</p></div><ScanLine /></div>
      <div className="scanner-grid">
        <div>
          <div className="scanner-view" id="react-qr-reader">
            {!scanner ? <div className="camera-off"><Camera size={30} /><span>Camera is off</span></div> : null}
          </div>
          <div className="scanner-actions">
            <button className="button primary" disabled={starting || Boolean(scanner)} onClick={startCamera}><ScanLine size={17} />{starting ? 'Starting' : 'Scan QR'}</button>
            {!scanner && !customer && locked.current ? <button className="icon-button" title="Scan again" onClick={() => { locked.current = false; setMessage('Ready to scan.'); }}><RefreshCw /></button> : null}
          </div>
          <p className="scanner-message">{message}</p>
        </div>
        <div className="checkout-panel">
          {customer ? (
            <div className="verified-customer">
              <div className="verified-title"><CheckCircle2 /><div><h3>{customer.name}</h3><p>{formatPhone(customer.phone)} · {customer.id}</p></div></div>
              {customer.isNewToMerchant ? <span className="tag info">New merchant connection</span> : null}
              <p className="balance-line">Current balance <strong>{formatPoints(customer.rewardPoints)} points</strong></p>
              <div className="purchase-fields">
                <label>Purchase amount (₹)<input className="amount-input" type="number" min="100" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                <label>Reward percentage<select value={percentage} onChange={(event) => setPercentage(Number(event.target.value))}>{settings.rewardOptions.map((option) => <option key={option} value={option}>{option}%</option>)}</select></label>
              </div>
              <div className="point-preview"><strong>{formatPoints(points)} points</strong></div>
              <p className="amount-rule">Minimum purchase ₹100</p>
              <button className="button primary full-button" disabled={Number(amount) < 100 || checkout.isPending} onClick={() => checkout.mutate()}>{checkout.isPending ? 'Processing' : 'Complete checkout'}</button>
            </div>
          ) : <div className="scan-placeholder"><ScanLine size={30} /><p>Scan a customer QR to begin checkout.</p></div>}
        </div>
      </div>
    </section>
  );
}
