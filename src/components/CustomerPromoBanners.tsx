import { uiText } from '../uiText';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Sparkles, ArrowRight, ShoppingBag, Gift, MessageSquare } from 'lucide-react';
import { apiFetch } from '../api';
import { CustomerOfferPreviewModal, type PreviewOfferData } from './CustomerOfferPreviewModal';
import { Link } from 'react-router-dom';

type Ad = {
  id: string;
  title: string;
  description: string;
  rawDescription?: string;
  imageUrl?: string;
  bannerImageUrl?: string;
  offerImageUrl?: string;
  merchantName?: string;
  merchantPhone?: string;
  merchantAddress?: string;
  category?: string;
  expiresAt?: string;
  url?: string;
};

export function CustomerPromoBanners({ location }: { location?: { latitude?: number; longitude?: number } | null } = {}) {
  const [selectedBanner, setSelectedBanner] = useState<PreviewOfferData | null>(null);

  const ads = useQuery({
    queryKey: ['customer', 'ads', location?.latitude, location?.longitude],
    queryFn: () => {
      const params = new URLSearchParams();
      if (location?.latitude != null && location?.longitude != null) {
        params.set('latitude', String(location.latitude));
        params.set('longitude', String(location.longitude));
      }
      const qs = params.toString();
      return apiFetch<{ ads: Ad[] }>(`/api/customer/ads${qs ? '?' + qs : ''}`);
    },
    staleTime: 60_000,
  });

  const allAds = ads.data?.ads || [];
  // Grab extra promotional banners with images (skipping slide 0 which is on the top hero)
  const promoAds = allAds.filter((a) => a.bannerImageUrl || a.imageUrl);
  const extraBanners = promoAds.length > 1 ? promoAds.slice(1, 6) : promoAds.slice(0, 4);

  return (
    <section className="space-y-3 pt-1" aria-label={uiText("Promotions and special banners")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles size={16} className="text-amber-500" />
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">{uiText("Featured Promotions")}</h3>
        </div>
        <Link to="/customer/offers" className="text-[12px] font-bold text-[#087a4b] hover:underline">
          {uiText("View all deals")}
        </Link>
      </div>

      {/* Extra Image Banners Horizontal Track */}
      {extraBanners.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
          {extraBanners.map((ad, idx) => {
            const img = ad.bannerImageUrl || ad.imageUrl;
            return (
              <div
                key={`extra-banner-${ad.id}-${idx}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedBanner({
                  id: ad.id,
                  title: ad.title,
                  description: ad.rawDescription || ad.description,
                  imageUrl: ad.offerImageUrl || ad.imageUrl || img,
                  bannerImageUrl: ad.bannerImageUrl,
                  merchantName: ad.merchantName,
                  merchantPhone: ad.merchantPhone,
                  merchantAddress: ad.merchantAddress,
                  category: ad.category,
                  expiresAt: ad.expiresAt,
                  url: ad.url,
                })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedBanner({
                      id: ad.id,
                      title: ad.title,
                      description: ad.rawDescription || ad.description,
                      imageUrl: ad.offerImageUrl || ad.imageUrl || img,
                      bannerImageUrl: ad.bannerImageUrl,
                      merchantName: ad.merchantName,
                      merchantPhone: ad.merchantPhone,
                      merchantAddress: ad.merchantAddress,
                      category: ad.category,
                      expiresAt: ad.expiresAt,
                      url: ad.url,
                    });
                  }
                }}
                className="snap-start shrink-0 w-[240px] h-[115px] rounded-xl overflow-hidden border border-gray-100 bg-gray-50 shadow-sm relative cursor-pointer active:scale-[0.98] transition-transform"
              >
                {img ? (
                  <img src={img} alt={ad.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full p-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex flex-col justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded w-max">
                      {uiText("Special Deal")}
                    </span>
                    <div>
                      <h4 className="font-bold text-xs line-clamp-1">{ad.title}</h4>
                      <p className="text-[11px] text-white/80 line-clamp-1">{ad.description}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modern Compact Promo Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <Link
          to="/customer/explore"
          className="flex flex-col justify-between p-3 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-teal-50 text-emerald-950 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <ShoppingBag size={14} />
            </div>
            <span className="text-[12px] font-bold leading-tight text-emerald-900">{uiText("Local Stores")}</span>
          </div>
          <p className="text-[10px] text-emerald-700 leading-tight mb-2">{uiText("Earn points on visits")}</p>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800">
            {uiText("Explore")} <ArrowRight size={11} />
          </span>
        </Link>

        <Link
          to="/customer/shop-scan?mode=redeem"
          className="flex flex-col justify-between p-3 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-blue-50 text-indigo-950 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Gift size={14} />
            </div>
            <span className="text-[12px] font-bold leading-tight text-indigo-900">{uiText("Redeem Deals")}</span>
          </div>
          <p className="text-[10px] text-indigo-700 leading-tight mb-2">{uiText("Instant discount off bill")}</p>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-800">
            {uiText("Redeem")} <ArrowRight size={11} />
          </span>
        </Link>
      </div>

      <CustomerOfferPreviewModal offer={selectedBanner} onClose={() => setSelectedBanner(null)} />
    </section>
  );
}
