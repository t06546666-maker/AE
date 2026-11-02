import { uiText } from '../uiText';
import { Store, Heart, MapPin } from 'lucide-react';
import { useState } from 'react';
import type { CustomerMerchant } from '../hooks/useCustomerData';
import './customer-shop-grid.css';

export function checkMerchantOpen(openingTime?: string | null, closingTime?: string | null): boolean {
  if (!openingTime || !closingTime) {
    const now = new Date();
    const istTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
    const current = istTimeStr.slice(0, 5);
    return current >= '09:00' && current < '21:30';
  }
  const now = new Date();
  const istTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
  const current = istTimeStr.slice(0, 5);
  const open = openingTime.slice(0, 5);
  const close = closingTime.slice(0, 5);
  if (close > open) {
    return current >= open && current < close;
  }
  return current >= open || current < close;
}

export function ShopPhoto({ merchant }: { merchant: CustomerMerchant }) {
  const [failed, setFailed] = useState(false);
  const photo = merchant.image_url || merchant.images?.[0];
  return photo && !failed ? (
    <img
      className="ae-shop-photo"
      src={photo}
      alt={merchant.merchant_name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="ae-shop-photo ae-shop-placeholder">
      <Store size={26} />
    </div>
  );
}

export function CustomerShopCard({
  merchant,
  onOpen,
  favorite,
  onFavorite,
  distance,
}: {
  merchant: CustomerMerchant;
  onOpen: () => void;
  favorite?: boolean;
  onFavorite?: () => void;
  distance?: number | null;
}) {
  const isOpen = checkMerchantOpen(merchant.opening_time, merchant.closing_time);
  const locationText = merchant.route_name || merchant.address?.split(',')?.[0]?.trim() || uiText('Chittur');
  const categoryText = merchant.category || uiText('Store');
  const distanceText = distance != null ? `${distance.toFixed(1)} km` : null;
  const subtitle = distanceText ? `${categoryText} · ${distanceText}` : categoryText;

  return (
    <article className="ae-shop-card">
      {onFavorite && (
        <button
          type="button"
          className="ae-shop-favorite"
          aria-label={favorite ? uiText("Remove favorite") : uiText("Add favorite")}
          aria-pressed={favorite}
          onClick={(e) => {
            e.stopPropagation();
            onFavorite();
          }}
        >
          <Heart size={15} fill={favorite ? '#e11d48' : 'none'} color={favorite ? '#e11d48' : '#94a3b8'} />
        </button>
      )}
      <button type="button" className="ae-shop-open" onClick={onOpen}>
        <div className="ae-shop-photo-wrapper">
          <ShopPhoto merchant={merchant} />
        </div>
        <div className="ae-shop-info">
          <h3 title={merchant.merchant_name}>{merchant.merchant_name}</h3>
          <p className="ae-shop-sub" title={subtitle}>{subtitle}</p>
          <div className="ae-shop-loc" title={locationText}>
            <MapPin size={11} className="ae-loc-icon" />
            <span>{locationText}</span>
          </div>
          <div className={`ae-shop-status ${isOpen ? 'open' : 'closed'}`}>
            <span className="ae-status-dot" />
            <span>{uiText(isOpen ? "Open" : "Closed")}</span>
          </div>
        </div>
      </button>
    </article>
  );
}
