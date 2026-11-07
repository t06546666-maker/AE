import { uiText } from '../uiText';
import { Store, Heart, MapPin, Navigation } from 'lucide-react';
import { useState } from 'react';
import type { CustomerMerchant } from '../hooks/useCustomerData';
import { formatClockTime } from '../utils';
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
      <Store size={34} />
      <span>{uiText("Photo not added")}</span>
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
  const hoursText = merchant.opening_time && merchant.closing_time
    ? `${formatClockTime(merchant.opening_time)} - ${formatClockTime(merchant.closing_time)}`
    : null;
  const locationText = merchant.route_name || merchant.address?.split(',')?.[0]?.trim() || uiText('Chittur');

  return (
    <article className="ae-shop-card">
      <button type="button" className="ae-shop-open" onClick={onOpen}>
        <ShopPhoto merchant={merchant} />
        <div className="ae-shop-card-content">
          <h3>{merchant.merchant_name}</h3>
          <p className="ae-shop-category">{merchant.category || uiText("AE Merchant")}</p>

          <div className="ae-shop-location">
            <MapPin size={12} className="ae-loc-icon" />
            <span>{locationText}</span>
          </div>

          {distance != null && (
            <small className="ae-shop-distance">
              <Navigation size={11} className="ae-nav-icon" />
              <span>{distance.toFixed(1)} {uiText("km from you")}</span>
            </small>
          )}

          <div className={`ae-shop-timing ${isOpen ? 'open' : 'closed'}`}>
            <span className="ae-status-dot" />
            <span className="ae-status-label">{uiText(isOpen ? "Open" : "Closed")}</span>
            {hoursText && <span className="ae-hours-label"> · {hoursText}</span>}
          </div>

          <span className="ae-view-shop">{uiText("View shop")}</span>
        </div>
      </button>

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
          <Heart size={20} fill={favorite ? '#e11d48' : 'none'} color={favorite ? '#e11d48' : '#526680'} />
        </button>
      )}
    </article>
  );
}
