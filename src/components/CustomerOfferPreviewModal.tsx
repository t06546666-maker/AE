import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ExternalLink, Phone, MessageCircle, Store, ZoomIn, ZoomOut, Calendar, Tag } from 'lucide-react';
import { uiText } from '../uiText';

export interface PreviewOfferData {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  merchantName?: string;
  merchantPhone?: string;
  merchantAddress?: string;
  category?: string;
  expiresAt?: string;
  url?: string;
}

interface CustomerOfferPreviewModalProps {
  offer: PreviewOfferData | null;
  onClose: () => void;
}

export function CustomerOfferPreviewModal({ offer, onClose }: CustomerOfferPreviewModalProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  if (!offer) return null;

  const phoneDigits = (offer.merchantPhone || '').replace(/\D/g, '');
  const cleanPhone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
        `Hello ${offer.merchantName || ''}, I saw your offer "${offer.title}" on the AE App!`
      )}`
    : '';

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 12, 28, 0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="customer-preview-card"
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: isZoomed ? '96vw' : '520px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          position: 'relative',
          transition: 'max-width 0.25s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid #f0f3f6',
            background: '#ffffff',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                background: '#e6f4ea',
                color: '#137333',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '12px',
              }}
            >
              {uiText('Ad & Offer Preview')}
            </span>
            {offer.category && (
              <span
                style={{
                  background: '#eef3fb',
                  color: '#1a56db',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Tag size={12} />
                {offer.category}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {offer.imageUrl && (
              <a
                href={offer.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={uiText('Open full image in Chrome / Browser')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0866db',
                  background: '#f0f6ff',
                  padding: '6px 10px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={14} />
                <span>{uiText('Open in Chrome')}</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                border: 0,
                background: '#f1f4f8',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                color: '#334155',
              }}
              title={uiText('Close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ overflowY: 'auto', padding: '16px 18px', flex: 1 }}>
          {/* Full High-Resolution Poster Image */}
          {offer.imageUrl ? (
            <div
              style={{
                position: 'relative',
                borderRadius: '18px',
                overflow: 'hidden',
                background: '#0d1829',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                marginBottom: '16px',
              }}
            >
              <img
                src={offer.imageUrl}
                alt={offer.title}
                style={{
                  width: '100%',
                  maxHeight: isZoomed ? '82vh' : '420px',
                  objectFit: 'contain',
                  cursor: isZoomed ? 'zoom-out' : 'zoom-in',
                  transition: 'max-height 0.2s ease',
                }}
                onClick={() => setIsZoomed(!isZoomed)}
                title={uiText('Click to zoom in / out')}
              />

              {/* Floating Zoom Button */}
              <button
                type="button"
                onClick={() => setIsZoomed(!isZoomed)}
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '12px',
                  background: 'rgba(0, 0, 0, 0.65)',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '20px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {isZoomed ? <ZoomOut size={14} /> : <ZoomIn size={14} />}
                <span>{isZoomed ? uiText('Zoom Out') : uiText('Zoom In')}</span>
              </button>
            </div>
          ) : null}

          {/* Offer Title & Store Name */}
          <div style={{ marginBottom: '14px' }}>
            <h2
              style={{
                fontSize: '19px',
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.3,
                margin: '0 0 6px',
              }}
            >
              {offer.title}
            </h2>

            {offer.merchantName && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#0866db',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                <Store size={16} />
                <span>{offer.merchantName}</span>
              </div>
            )}

            {offer.merchantAddress && (
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                {offer.merchantAddress}
              </p>
            )}
          </div>

          {/* Description & Terms */}
          {offer.description && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '12px 14px',
                marginBottom: '16px',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#64748b',
                  marginBottom: '4px',
                }}
              >
                {uiText('Offer Details & Terms')}
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#1e293b',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {offer.description}
              </p>
            </div>
          )}

          {/* Expiry Date */}
          {offer.expiresAt && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: '#64748b',
                marginBottom: '18px',
              }}
            >
              <Calendar size={14} color="#e11d48" />
              <span>
                {uiText('Valid until: ')}
                <strong style={{ color: '#0f172a' }}>
                  {new Date(offer.expiresAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </strong>
              </span>
            </div>
          )}

          {/* Action Buttons: Call, WhatsApp, Open in Chrome */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: offer.merchantPhone ? '1fr 1fr' : '1fr',
              gap: '10px',
              marginTop: '8px',
            }}
          >
            {offer.merchantPhone && (
              <a
                href={`tel:${offer.merchantPhone}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#0866db',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(8, 102, 219, 0.22)',
                }}
              >
                <Phone size={16} />
                <span>{uiText('Call Store')}</span>
              </a>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#25d366',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.22)',
                }}
              >
                <MessageCircle size={16} />
                <span>{uiText('WhatsApp')}</span>
              </a>
            )}
          </div>

          {/* Secondary Actions */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginTop: '10px',
            }}
          >
            {offer.imageUrl && (
              <a
                href={offer.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: '#f1f5f9',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '12px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={14} />
                <span>{uiText('View Full Poster in Chrome')}</span>
              </a>
            )}

            <Link
              to={offer.url?.startsWith('/customer/') ? offer.url : '/customer/explore'}
              onClick={onClose}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#f1f5f9',
                color: '#334155',
                fontWeight: 600,
                fontSize: '12px',
                padding: '10px 12px',
                borderRadius: '12px',
                textDecoration: 'none',
              }}
            >
              <Store size={14} />
              <span>{uiText('Explore Store')}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

