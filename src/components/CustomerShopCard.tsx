import { uiText } from '../uiText';
import { Store, Heart } from 'lucide-react';
import { useState } from 'react';
import type { CustomerMerchant } from '../hooks/useCustomerData';
import './customer-shop-grid.css';

export function ShopPhoto({ merchant }: { merchant: CustomerMerchant }) {
  const [failed, setFailed] = useState(false);
  const photo = merchant.image_url || merchant.images?.[0];
  return photo && !failed ? <img className="ae-shop-photo" src={photo} alt={merchant.merchant_name} loading="lazy" onError={() => setFailed(true)} /> : <div className="ae-shop-photo ae-shop-placeholder"><Store size={34} /><span>{uiText("Photo not added")}</span></div>;
}
export function CustomerShopCard({ merchant, onOpen, favorite, onFavorite, distance }: { merchant: CustomerMerchant; onOpen: () => void; favorite?: boolean; onFavorite?: () => void; distance?: number | null }) {
  return <article className="ae-shop-card"><button type="button" className="ae-shop-open" onClick={onOpen}><ShopPhoto merchant={merchant} /><div><h3>{merchant.merchant_name}</h3><p>{merchant.category || 'AE Merchant'}</p>{distance != null && <small>{distance.toFixed(1)}{uiText(" km away")}</small>}<span>{uiText("View shop")}</span></div></button>{onFavorite && <button className="ae-shop-favorite" aria-label={favorite ? uiText("Remove favorite") : uiText("Add favorite")} aria-pressed={favorite} onClick={onFavorite}><Heart size={20} fill={favorite ? '#e11d48' : 'none'} color={favorite ? '#e11d48' : '#526680'} /></button>}</article>;
}
