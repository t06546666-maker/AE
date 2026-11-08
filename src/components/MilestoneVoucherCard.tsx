import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Gift,
  Store,
  Calendar,
  Sparkles,
  CheckCircle2,
  MapPin,
  QrCode,
  X,
  ExternalLink,
  ChevronRight,
  Info,
  ShoppingBag,
  Percent,
} from 'lucide-react';
import { uiText } from '../uiText';
import './milestone-voucher-card.css';

export interface VoucherItem {
  id: string;
  merchantName: string;
  category: string;
  amount: number;
  icon?: string;
  address?: string;
  validUntil?: string;
  terms?: string;
}

export interface MilestoneVoucherCardProps {
  customerName?: string;
  milestoneTitle?: string;
  milestoneSubtitle?: string;
  totalAmount?: number;
  validUntil?: string;
  vouchers?: VoucherItem[];
  onRedeemClick?: (voucher: VoucherItem) => void;
  compact?: boolean;
}

const DEFAULT_VOUCHERS: VoucherItem[] = [
  {
    id: 'v1',
    merchantName: 'Al-Madeena Hypermarket',
    category: 'Supermarket & Essentials',
    amount: 250,
    icon: '🛒',
    address: 'Main Road, Chittur',
    validUntil: '30 Nov 2026',
    terms: 'Valid on purchases above ₹500. Present QR at billing counter.',
  },
  {
    id: 'v2',
    merchantName: 'Royal Bakers & Sweets',
    category: 'Bakery & Confectionery',
    amount: 250,
    icon: '🥐',
    address: 'College Junction, Chittur',
    validUntil: '30 Nov 2026',
    terms: 'Valid on fresh bakes, cakes, and snacks. Single-time use.',
  },
  {
    id: 'v3',
    merchantName: 'City Trendz Apparels',
    category: 'Fashion & Wear',
    amount: 250,
    icon: '👕',
    address: 'Town Square, Chittur',
    validUntil: '30 Nov 2026',
    terms: 'Applicable on menswear, ladieswear, and kids collection.',
  },
  {
    id: 'v4',
    merchantName: 'Care Medicals',
    category: 'Pharmacy & Wellness',
    amount: 250,
    icon: '💊',
    address: 'Hospital Road, Chittur',
    validUntil: '30 Nov 2026',
    terms: 'Valid on healthcare, supplements, and OTC wellness items.',
  },
];

export function MilestoneVoucherCard({
  customerName = 'Rasheed',
  milestoneTitle,
  milestoneSubtitle,
  totalAmount = 1000,
  validUntil = '30 Nov 2026',
  vouchers = DEFAULT_VOUCHERS,
  onRedeemClick,
  compact = false,
}: MilestoneVoucherCardProps) {
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherItem | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [redeemedMap, setRedeemedMap] = useState<Record<string, boolean>>({});
  const [showTerms, setShowTerms] = useState(false);

  // Load redeemed vouchers from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ae_redeemed_milestone_vouchers');
      if (saved) setRedeemedMap(JSON.parse(saved));
    } catch {}
  }, []);

  // Generate QR when a voucher is clicked
  useEffect(() => {
    if (!selectedVoucher) {
      setQrCodeDataUrl('');
      return;
    }
    const payload = JSON.stringify({
      type: 'ae_milestone_voucher',
      voucherId: selectedVoucher.id,
      merchant: selectedVoucher.merchantName,
      amount: selectedVoucher.amount,
      customer: customerName,
      validUntil: selectedVoucher.validUntil || validUntil,
      code: `AE-VOUCH-${selectedVoucher.id}-${selectedVoucher.amount}`,
    });

    QRCode.toDataURL(payload, {
      width: 220,
      margin: 1.5,
      color: { dark: '#0c2340', light: '#ffffff' },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch(() => setQrCodeDataUrl(''));
  }, [selectedVoucher, customerName, validUntil]);

  const handleMarkRedeemed = (voucherId: string) => {
    const next = { ...redeemedMap, [voucherId]: true };
    setRedeemedMap(next);
    try {
      localStorage.setItem('ae_redeemed_milestone_vouchers', JSON.stringify(next));
    } catch {}
  };

  const remainingCount = vouchers.filter((v) => !redeemedMap[v.id]).length;

  return (
    <div className={`milestone-voucher-container ${compact ? 'compact' : ''}`}>
      {/* Radiant Top Glow Card */}
      <div className="milestone-hero-card">
        {/* Decorative background glow & confetti circles */}
        <div className="milestone-glow-circle-1" />
        <div className="milestone-glow-circle-2" />

        {/* Top Badge & Customer Salutation */}
        <div className="milestone-header-row">
          <div className="milestone-badge">
            <Sparkles size={13} className="milestone-badge-icon" />
            <span>{uiText('ആദ്യ ഇടപാട് സമ്മാനം (1st Transaction Gift)')}</span>
          </div>
          <span className="milestone-total-pill">
            <Gift size={12} />
            <span>₹{totalAmount} {uiText('സമ്മാനം')}</span>
          </span>
        </div>

        {/* Customer Personalized Greeting */}
        <div className="milestone-salutation-block">
          <h3 className="milestone-greeting-title">
            {uiText('പ്രിയപ്പെട്ട {{name}},', { name: customerName })}
          </h3>
          <p className="milestone-gratitude-text">
            {milestoneSubtitle ||
              uiText('AE-യുടെ ചരിത്രത്തിലെ ആദ്യ ഇടപാട് നടത്തിയതിന് ഹൃദയം നിറഞ്ഞ നന്ദി! ❤️')}
          </p>
        </div>

        {/* Value Highlight Banner */}
        <div className="milestone-value-ribbon">
          <div className="milestone-value-left">
            <span className="milestone-value-label">{uiText('ആകെ സമ്മാനത്തുക (Total Value)')}</span>
            <div className="milestone-value-number">
              <span className="currency">₹</span>
              <span className="amount">{totalAmount}</span>
            </div>
          </div>
          <div className="milestone-value-right">
            <span className="milestone-store-count">
              {vouchers.length} {uiText('മുൻനിര സ്ഥാപനങ്ങൾ')}
            </span>
            <span className="milestone-remaining-badge">
              {remainingCount} {uiText('ലഭ്യം (Available)')}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Partner Store Vouchers List */}
      <div className="milestone-vouchers-section">
        <div className="milestone-vouchers-title-row">
          <span className="milestone-vouchers-title">
            <Store size={14} className="text-blue-600" />
            <span>{uiText('നിങ്ങളുടെ സമ്മാന വൗച്ചറുകൾ (Your Store Vouchers):')}</span>
          </span>
          <span className="milestone-vouchers-sub">
            {uiText('സ്ഥാപനങ്ങൾ സന്ദർശിച്ച് ഉപയോഗിക്കാം 🎀')}
          </span>
        </div>

        <div className="milestone-vouchers-grid">
          {vouchers.map((voucher) => {
            const isRedeemed = redeemedMap[voucher.id];
            return (
              <div
                key={voucher.id}
                className={`milestone-voucher-ticket ${isRedeemed ? 'redeemed' : ''}`}
                onClick={() => {
                  setSelectedVoucher(voucher);
                  if (onRedeemClick) onRedeemClick(voucher);
                }}
              >
                {/* Left Ticket Notch */}
                <div className="ticket-notch notch-left" />

                {/* Main Ticket Body */}
                <div className="ticket-main">
                  <div className="ticket-header">
                    <span className="ticket-icon">{voucher.icon || '🛍️'}</span>
                    <span className="ticket-amount">₹{voucher.amount}</span>
                  </div>
                  <h4 className="ticket-store-name">{voucher.merchantName}</h4>
                  <span className="ticket-category">{voucher.category}</span>

                  <div className="ticket-footer">
                    {isRedeemed ? (
                      <span className="ticket-status-redeemed">
                        <CheckCircle2 size={12} /> {uiText('ഉപയോഗിച്ചു (Used)')}
                      </span>
                    ) : (
                      <span className="ticket-action-cta">
                        <QrCode size={12} /> {uiText('ക്ലെയിം ചെയ്യൂ (Redeem)')}
                        <ChevronRight size={11} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Ticket Notch */}
                <div className="ticket-notch notch-right" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Validity & Branding Footer */}
      <div className="milestone-footer-card">
        <div className="milestone-validity-row">
          <div className="milestone-validity-item">
            <Calendar size={13} className="text-amber-600" />
            <span>{uiText('സാധുത (Valid until):')} <strong>{validUntil}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => setShowTerms(!showTerms)}
            className="milestone-terms-link"
          >
            <Info size={12} />
            <span>{uiText('നിബന്ധനകൾ ബാധകം')}</span>
          </button>
        </div>

        {showTerms && (
          <div className="milestone-terms-dropdown">
            <p>• {uiText('ഒരു ബില്ലിംഗിൽ ഒരു വൗച്ചർ മാത്രമേ ഉപയോഗിക്കാൻ സാധിക്കൂ.')}</p>
            <p>• {uiText('നിർദ്ദിഷ്ട AE പങ്കാളിത്ത സ്റ്റോറുകളിൽ മാത്രമേ സാധുതയുള്ളൂ.')}</p>
            <p>• {uiText('പണമായി കൈമാറാൻ സാധ്യമല്ല (Not redeemable for raw cash).')}</p>
            <p>• {uiText('സാധുത തീയതിക്ക് ശേഷം വൗച്ചറുകൾ അസാധുവാകും.')}</p>
          </div>
        )}

        <div className="milestone-brand-tagline">
          <span>AE — Where customers meet businesses and beyond.</span>
          <a
            href="https://instagram.com/ae.kerala"
            target="_blank"
            rel="noopener noreferrer"
            className="milestone-instagram-badge"
          >
            <span>📲 Instagram: @ae.kerala</span>
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Interactive Voucher Redemption Modal */}
      {selectedVoucher && (
        <div className="milestone-modal-backdrop" onClick={() => setSelectedVoucher(null)}>
          <div
            className="milestone-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="milestone-modal-header">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedVoucher.icon || '🎁'}</span>
                <div>
                  <h3 className="milestone-modal-title">{selectedVoucher.merchantName}</h3>
                  <span className="milestone-modal-subtitle">{selectedVoucher.category}</span>
                </div>
              </div>
              <button
                type="button"
                className="milestone-modal-close"
                onClick={() => setSelectedVoucher(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Voucher Value Hero */}
            <div className="milestone-modal-hero">
              <span className="modal-hero-tag">{uiText('ഗിഫ്റ്റ് വൗച്ചർ (Gift Voucher)')}</span>
              <div className="modal-hero-amount">
                <span className="curr">₹</span>
                <span className="val">{selectedVoucher.amount}</span>
              </div>
              <span className="modal-hero-expiry">
                <Calendar size={12} /> {uiText('സാധുത:')} {selectedVoucher.validUntil || validUntil}
              </span>
            </div>

            {/* QR Code Presentation for Counter Staff */}
            <div className="milestone-modal-qr-box">
              {redeemedMap[selectedVoucher.id] ? (
                <div className="milestone-qr-redeemed-state">
                  <CheckCircle2 size={44} className="text-emerald-500 mb-2" />
                  <span className="text-sm font-bold text-gray-800">
                    {uiText('ഈ വൗച്ചർ ഇതിനകം ഉപയോഗിച്ചു')}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {uiText('Used at {{store}}', { store: selectedVoucher.merchantName })}
                  </span>
                </div>
              ) : (
                <>
                  <div className="milestone-qr-wrapper">
                    {qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="Voucher QR" className="milestone-qr-img" />
                    ) : (
                      <div className="milestone-qr-skeleton" />
                    )}
                  </div>
                  <span className="milestone-qr-instruction">
                    {uiText('ബില്ലിംഗ് കൗണ്ടറിൽ ഈ QR കോഡ് കാണിച്ച് ₹{{amt}} ഡിസ്കൗണ്ട് നേടൂ', {
                      amt: selectedVoucher.amount,
                    })}
                  </span>
                  <div className="milestone-code-pill">
                    <span>AE-VOUCH-{selectedVoucher.id.toUpperCase()}-{selectedVoucher.amount}</span>
                  </div>
                </>
              )}
            </div>

            {/* Location & Instructions */}
            <div className="milestone-modal-store-info">
              <div className="flex items-center gap-1.5 text-xs text-gray-700">
                <MapPin size={13} className="text-blue-600 shrink-0" />
                <span className="font-semibold">{selectedVoucher.address || 'Chittur, Palakkad'}</span>
              </div>
              {selectedVoucher.terms && (
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed bg-blue-50/60 p-2 rounded-lg border border-blue-100">
                  ℹ️ {selectedVoucher.terms}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="milestone-modal-actions">
              {!redeemedMap[selectedVoucher.id] ? (
                <button
                  type="button"
                  className="milestone-mark-btn"
                  onClick={() => handleMarkRedeemed(selectedVoucher.id)}
                >
                  <CheckCircle2 size={16} />
                  <span>{uiText('ഉപയോഗിച്ചു എന്ന് അടയാളപ്പെടുത്തുക (Mark as Used)')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="milestone-close-btn"
                  onClick={() => setSelectedVoucher(null)}
                >
                  <span>{uiText('Close')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

