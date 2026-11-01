import { uiText } from '../../uiText';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Eye, Heart, MapPin, Flame } from 'lucide-react';
import { useCustomerOffers, type CustomerOffer } from '../../hooks/useCustomerData';
import { useCustomerLocation } from '../../hooks/useCustomerLocation';
import { CustomerOfferPreviewModal, type PreviewOfferData } from '../../components/CustomerOfferPreviewModal';
import { visitDistance } from '../../visitLocation';

const CATEGORIES = ['All', 'Nearby', 'Trending', 'Favorites'] as const;
type CategoryType = (typeof CATEGORIES)[number];

export function CustomerOffers() {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('All');
  const [selectedOffer, setSelectedOffer] = useState<PreviewOfferData | null>(null);

  // Customer location for accurate nearby calculation
  const customerLocation = useCustomerLocation(true, true);
  const coords = customerLocation.data?.latitude != null && customerLocation.data?.longitude != null
    ? { latitude: customerLocation.data.latitude, longitude: customerLocation.data.longitude }
    : null;
  const { data, isLoading } = useCustomerOffers(true, coords);
  const offers = data?.offers ?? [];

  // Customer favorite store IDs from localStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ae_favorite_merchants') || '[]');
    } catch {
      return [];
    }
  });

  const toggleFavorite = (merchantId?: string) => {
    if (!merchantId) return;
    setFavorites((current) => {
      const next = current.includes(merchantId)
        ? current.filter((id) => id !== merchantId)
        : [...current, merchantId];
      try {
        localStorage.setItem('ae_favorite_merchants', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const getOfferDistance = (offer: CustomerOffer): number | null => {
    if (offer.distance != null && Number.isFinite(offer.distance)) {
      return offer.distance;
    }
    if (
      coords &&
      offer.latitude != null &&
      offer.longitude != null &&
      Number.isFinite(offer.latitude) &&
      Number.isFinite(offer.longitude)
    ) {
      return (
        visitDistance(
          coords.latitude,
          coords.longitude,
          offer.latitude,
          offer.longitude
        ) / 1000
      );
    }
    return null;
  };

  // Filter & Sort offers based on active tab
  const filteredOffers = useMemo(() => {
    if (activeCategory === 'All') {
      return offers;
    }

    if (activeCategory === 'Nearby') {
      // Sort strictly from nearest shop to furthest shop (closest at top)
      return [...offers]
        .map((offer) => ({
          offer,
          dist: getOfferDistance(offer),
        }))
        .sort((a, b) => {
          const distA = a.dist ?? Infinity;
          const distB = b.dist ?? Infinity;
          return distA - distB;
        })
        .map((item) => item.offer);
    }

    if (activeCategory === 'Trending') {
      // Filter offers marked as trending in database or category
      return offers.filter(
        (o) =>
          o.is_trending === true ||
          (o as any).trending === true ||
          (o as any).featured === true ||
          o.category?.toLowerCase() === 'trending' ||
          (o as any).audience?.toLowerCase() === 'trending'
      );
    }

    if (activeCategory === 'Favorites') {
      // Only show offers from merchant shops that the customer has favorited!
      const favSet = new Set(favorites);
      return offers.filter((o) => o.merchant_id && favSet.has(o.merchant_id));
    }

    return offers;
  }, [offers, activeCategory, favorites, coords]);

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/home" aria-label={uiText("Back")}>
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-lg font-bold">{uiText("Offers")}</h1>
        </div>
      </header>

      {/* Category Tabs */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide -mx-5 px-5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
                activeCategory === cat
                  ? 'bg-[#087a4b] text-white shadow-md shadow-green-600/20 scale-[1.02]'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {uiText(cat)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-2 space-y-4">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400">{uiText("Loading offers...")}</div>
        ) : filteredOffers.length === 0 ? (
          activeCategory === 'Favorites' ? (
            <div className="py-12 px-6 text-center bg-white rounded-2xl shadow-sm border border-gray-100 mt-2">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 mx-auto flex items-center justify-center mb-3">
                <Heart size={24} fill="#f43f5e" />
              </div>
              <h3 className="font-bold text-gray-800 text-base">{uiText("No Favorite Store Offers Yet")}</h3>
              <p className="mt-1 text-xs text-gray-500 max-w-xs mx-auto">
                {uiText("Tap the heart icon on any store to save it as a favorite. Their offers will appear here automatically!")}
              </p>
              <Link
                to="/customer/explore"
                className="mt-4 inline-block rounded-full bg-[#087a4b] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#076940] transition-colors"
              >
                {uiText("Browse Stores in Explore")}
              </Link>
            </div>
          ) : activeCategory === 'Trending' ? (
            <div className="py-12 px-6 text-center bg-white rounded-2xl shadow-sm border border-gray-100 mt-2">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 mx-auto flex items-center justify-center mb-3">
                <Flame size={24} />
              </div>
              <h3 className="font-bold text-gray-800 text-base">{uiText("No Trending Offers Yet")}</h3>
              <p className="mt-1 text-xs text-gray-500 max-w-xs mx-auto">
                {uiText("Hot trending deals and viral promotions will appear here once active!")}
              </p>
              <button
                type="button"
                onClick={() => setActiveCategory('All')}
                className="mt-4 inline-block rounded-full bg-[#087a4b] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#076940] transition-colors"
              >
                {uiText("View All Offers")}
              </button>
            </div>
          ) : activeCategory === 'Nearby' ? (
            <div className="py-12 px-6 text-center bg-white rounded-2xl shadow-sm border border-gray-100 mt-2">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 mx-auto flex items-center justify-center mb-3">
                <MapPin size={24} />
              </div>
              <h3 className="font-bold text-gray-800 text-base">{uiText("No Nearby Offers Found")}</h3>
              <p className="mt-1 text-xs text-gray-500 max-w-xs mx-auto">
                {uiText("No offers found nearby. Browse all offers across Chittur & Thathamangalam!")}
              </p>
              <button
                type="button"
                onClick={() => setActiveCategory('All')}
                className="mt-4 inline-block rounded-full bg-[#087a4b] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#076940] transition-colors"
              >
                {uiText("View All Offers")}
              </button>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400">
              {uiText("No active offers right now.")}
            </div>
          )
        ) : (
          filteredOffers.map((offer) => {
            const dist = getOfferDistance(offer);
            const isFav = offer.merchant_id ? favorites.includes(offer.merchant_id) : false;

            return (
              <div
                key={offer.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  setSelectedOffer({
                    id: offer.id,
                    title: offer.title,
                    description: offer.description,
                    imageUrl: offer.offerImageUrl || offer.imageUrl,
                    bannerImageUrl: offer.bannerImageUrl || undefined,
                    merchantName: offer.merchant_raw_name || offer.merchant_name,
                    merchantPhone: offer.merchant_phone,
                    merchantAddress: offer.merchant_address,
                    category: offer.category,
                    expiresAt: offer.expires_at,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedOffer({
                      id: offer.id,
                      title: offer.title,
                      description: offer.description,
                      imageUrl: offer.offerImageUrl || offer.imageUrl,
                      bannerImageUrl: offer.bannerImageUrl || undefined,
                      merchantName: offer.merchant_raw_name || offer.merchant_name,
                      merchantPhone: offer.merchant_phone,
                      merchantAddress: offer.merchant_address,
                      category: offer.category,
                      expiresAt: offer.expires_at,
                    });
                  }
                }}
                className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden flex active:scale-[0.98] transition-transform p-3 cursor-pointer hover:border-blue-200 relative"
              >
                {/* Favorite Heart Toggle on Card */}
                {offer.merchant_id && (
                  <button
                    type="button"
                    aria-label={isFav ? uiText("Remove favorite") : uiText("Add favorite")}
                    aria-pressed={isFav}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(offer.merchant_id);
                    }}
                    className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/95 shadow-sm flex items-center justify-center hover:scale-110 active:scale-90 transition-all border border-gray-100"
                  >
                    <Heart
                      size={15}
                      fill={isFav ? '#e11d48' : 'none'}
                      color={isFav ? '#e11d48' : '#64748b'}
                    />
                  </button>
                )}

                <div className="w-[100px] h-[100px] bg-gray-100 rounded-[16px] flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                  {offer.imageUrl ? (
                    <img src={offer.imageUrl} alt={offer.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-300 rounded-full" />
                  )}
                  <span className="absolute bottom-1 right-1 bg-black/60 text-white rounded-full p-1">
                    <Eye size={12} />
                  </span>
                </div>

                <div className="p-3 pr-8 flex-1 flex flex-col justify-center relative">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-[15px] text-gray-900 leading-tight">{offer.title}</h3>
                    {offer.is_trending && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                        <Flame size={10} />
                        {uiText("Trending")}
                      </span>
                    )}
                  </div>

                  <p className="font-bold text-[14px] text-[#e11d48] mt-1 leading-tight line-clamp-2">
                    {offer.description}
                  </p>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="font-semibold text-[13px] text-gray-700 leading-tight">
                      {uiText("at ")}{offer.merchant_raw_name || offer.merchant_name || 'Store'}
                    </p>
                    {dist != null && Number.isFinite(dist) && dist < 100 && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <MapPin size={10} />
                        {dist.toFixed(1)} km
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <p className="text-[11px] font-medium text-gray-500">
                      {uiText(" Valid till ")}{new Date(offer.expires_at).toLocaleDateString()}
                    </p>
                    <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                      {uiText('View Ad')} <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Full In-App Offer Preview Modal */}
      <CustomerOfferPreviewModal offer={selectedOffer} onClose={() => setSelectedOffer(null)} />
    </div>
  );
}
