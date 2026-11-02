import { uiText } from '../../uiText';
import { CustomerShopCard, checkMerchantOpen } from '../../components/CustomerShopCard';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, X, Map } from 'lucide-react';
import { useCustomerMerchants, useCustomerCategories } from '../../hooks/useCustomerData';
import { useEffect, useState } from 'react';
import { CustomerNearbyMap } from '../../components/CustomerNearbyMap';
import { useCustomerLocation } from '../../hooks/useCustomerLocation';
import { CustomerLocationBar } from '../../components/CustomerLocationBar';
import { apiFetch } from '../../api';

export function CustomerExplore() {
  const routeLocation = useLocation();
  const [reviewError, setReviewError] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'all' | 'nearby' | 'open'>('all');
  const [favorites, setFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem('ae_favorite_merchants') || '[]'));
  const currentLocation = useCustomerLocation(true, true);
  const userLocation = currentLocation.data?.routeGroup ? currentLocation.data : { ...currentLocation.data, area: 'All', routeGroup: 'all' as const };
  const [detailMerchant, setDetailMerchant] = useState<typeof merchants[number] | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);

  const categoriesQuery = useCustomerCategories();
  const { data, isLoading, isError, refetch } = useCustomerMerchants(page, search, selectedCategory, userLocation);
  const merchants = data?.merchants ?? [];

  const distanceKm = (latitude?: number | null, longitude?: number | null) => {
    if (latitude == null || longitude == null) return null;
    const refLat = userLocation?.latitude ?? 10.7005;
    const refLon = userLocation?.longitude ?? 76.7475;
    const rad = Math.PI / 180;
    const dLat = (latitude - refLat) * rad;
    const dLon = (longitude - refLon) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(refLat * rad) * Math.cos(latitude * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const requestLiveLocation = async () => {
    try {
      await currentLocation.refetch();
    } catch {}
  };

  useEffect(() => setPage(1), [userLocation?.routeGroup, userLocation?.latitude, userLocation?.longitude]);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    if (cat !== 'All') {
      setSelectedCategory(cat);
    } else {
      setSelectedCategory('all');
    }
    setPage(1);
  };

  const toggleFavorite = (id: string) => setFavorites(current => {
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    localStorage.setItem('ae_favorite_merchants', JSON.stringify(next));
    return next;
  });

  const openMerchant = async (merchant: typeof merchants[number]) => {
    setReviewMessage('');
    setReviewRating(5);
    setReviews([]);
    setDetailMerchant(merchant);
    setSelectedMerchantId(merchant.id);
    if (showMap) {
      document.getElementById('customer-nearby-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    try {
      const result = await apiFetch<{ reviews: any[] }>(`/api/customer/merchant-reviews/${merchant.id}`);
      setReviews(result.reviews || []);
    } catch {
      setReviews([]);
    }
  };

  const submitReview = async () => {
    if (!detailMerchant || reviewBusy || reviewMessage.trim().length < 2) return;
    setReviewBusy(true);
    setReviewError('');
    try {
      await apiFetch('/api/customer/feedback', {
        method: 'POST',
        body: JSON.stringify({
          feedback_type: 'merchant',
          merchant_id: detailMerchant.id,
          rating: reviewRating,
          message: reviewMessage.trim()
        })
      });
      setReviewMessage('');
      const result = await apiFetch<{ reviews: any[] }>(`/api/customer/merchant-reviews/${detailMerchant.id}`);
      setReviews(result.reviews || []);
    } catch (error) {
      setReviewError((error as Error).message);
    } finally {
      setReviewBusy(false);
    }
  };

  useEffect(() => {
    const merchant = routeLocation.state?.merchant;
    if (merchant?.id) void openMerchant(merchant);
  }, [routeLocation.key]);

  let displayedMerchants = [...merchants];
  if (quickFilter === 'open') {
    displayedMerchants = displayedMerchants.filter(m => checkMerchantOpen(m.opening_time, m.closing_time));
  } else if (quickFilter === 'nearby') {
    displayedMerchants.sort((a, b) => {
      const da = distanceKm(a.latitude, a.longitude) ?? Infinity;
      const db = distanceKm(b.latitude, b.longitude) ?? Infinity;
      return da - db;
    });
  }

  return (
    <div className="customer-modern-page bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Top Header Bar with Back Arrow, Location Dropdown, and Map Toggle */}
      <header className="flex justify-between items-center px-4 py-3 bg-[#f8fbfe]/95 backdrop-blur-md sticky top-0 z-20 shadow-[0_2px_10px_rgba(0,102,244,0.04)] border-b border-[#d8e8f8]/80 gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Link to="/customer/home" className="p-1 text-slate-700 hover:text-[#0066f4] shrink-0 transition-colors" aria-label={uiText("Back to Home")}>
            <ArrowLeft size={22} />
          </Link>
          <div className="flex-1 min-w-0">
            <CustomerLocationBar compact defaultAll />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 shadow-sm ${
            showMap
              ? 'bg-[#0066f4] text-white border-[#0066f4] shadow-blue-500/25'
              : 'bg-white text-[#0066f4] border-[#d8e8f8] hover:bg-blue-50/80 hover:border-[#0066f4]/40'
          }`}
          aria-label={uiText("Toggle map view")}
        >
          <Map size={15} className={showMap ? 'text-white' : 'text-[#0066f4]'} />
          <span>{showMap ? uiText("List") : uiText("Map")}</span>
        </button>
      </header>

      {/* Hero Section: Search & Categories with Unified AE Soft Blue Theme */}
      <div className="bg-gradient-to-b from-[#eef6fc] via-[#f5f9fd] to-[#f8fbfe] px-4 pt-3 pb-3 border-b border-[#dce8f5] shadow-[0_4px_16px_rgba(0,102,244,0.03)] space-y-3">
        {/* Search Bar - Crisp white floating card on soft blue canvas */}
        <div className="relative flex items-center">
          <Search size={18} className="absolute left-3.5 text-[#0066f4] pointer-events-none" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={uiText("Search shops near you...")}
            className="w-full bg-white border border-[#cfe2f7] rounded-[16px] pl-10 pr-9 py-2.5 text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0066f4] focus:ring-2 focus:ring-[#0066f4]/20 shadow-[0_2px_8px_rgba(0,102,244,0.06)] transition-all"
          />
          {inputValue ? (
            <button
              type="button"
              onClick={() => {
                setInputValue('');
                setSearch('');
                setPage(1);
              }}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              aria-label={uiText("Clear search")}
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        {/* Horizontal Scrolling Categories - AE Blue Gradient for Active */}
        <div className="glass-categories flex items-center overflow-x-auto gap-2 pb-0.5 scrollbar-hide -mx-4 px-4">
          <button
            key="all"
            type="button"
            onClick={() => handleCategoryChange('All')}
            className={`shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
              activeCategory === 'All'
                ? 'bg-gradient-to-r from-[#0066f4] to-[#009be5] text-white shadow-md shadow-blue-500/25 active'
                : 'bg-white text-slate-700 border border-[#d8e8f8] hover:bg-blue-50/80 hover:border-[#0066f4]/40 shadow-xs'
            }`}
          >
            {uiText("All")}
          </button>
          {categoriesQuery.data?.categories?.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.id)}
              className={`shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
                activeCategory === cat.id
                  ? 'bg-gradient-to-r from-[#0066f4] to-[#009be5] text-white shadow-md shadow-blue-500/25 active'
                  : 'bg-white text-slate-700 border border-[#d8e8f8] hover:bg-blue-50/80 hover:border-[#0066f4]/40 shadow-xs'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Filter Chips (All, Nearby, Open now) - AE Blue Theme */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <button
          type="button"
          onClick={() => setQuickFilter('all')}
          className={`shrink-0 px-3.5 py-1 rounded-full text-[12px] font-semibold transition-all ${
            quickFilter === 'all'
              ? 'bg-[#0066f4] text-white shadow-sm shadow-blue-500/25'
              : 'bg-white text-slate-600 border border-[#d8e8f8] hover:bg-blue-50/80 shadow-xs'
          }`}
        >
          {uiText("All")}
        </button>
        <button
          type="button"
          onClick={() => setQuickFilter('nearby')}
          className={`shrink-0 px-3.5 py-1 rounded-full text-[12px] font-semibold transition-all ${
            quickFilter === 'nearby'
              ? 'bg-[#0066f4] text-white shadow-sm shadow-blue-500/25'
              : 'bg-white text-slate-600 border border-[#d8e8f8] hover:bg-blue-50/80 shadow-xs'
          }`}
        >
          {uiText("Nearby")}
        </button>
        <button
          type="button"
          onClick={() => setQuickFilter('open')}
          className={`shrink-0 px-3.5 py-1 rounded-full text-[12px] font-semibold transition-all ${
            quickFilter === 'open'
              ? 'bg-[#0066f4] text-white shadow-sm shadow-blue-500/25'
              : 'bg-white text-slate-600 border border-[#d8e8f8] hover:bg-blue-50/80 shadow-xs'
          }`}
        >
          {uiText("Open now")}
        </button>
      </div>

      {/* GPS Location Prompt Banner if not yet granted */}
      {currentLocation.data?.latitude == null && (
        <div className="mx-4 mt-2 px-3.5 py-2 rounded-xl bg-blue-50/90 border border-blue-200/80 flex items-center justify-between gap-2 shadow-xs">
          <p className="text-[11.5px] text-blue-900 font-medium">
            {uiText("Tap to use live GPS for exact distance from you")}
          </p>
          <button
            type="button"
            onClick={requestLiveLocation}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-[#0066f4] text-white text-[11px] font-bold shadow-xs active:scale-95 transition-transform"
          >
            {uiText("Use GPS")}
          </button>
        </div>
      )}

      {/* Map View (Toggleable via header Map button) */}
      {showMap && (
        <div className="px-4 pt-2 pb-2">
          <CustomerNearbyMap merchants={merchants} selectedMerchantId={selectedMerchantId} allowLocate={false} />
        </div>
      )}

      {userLocation?.routeGroup && userLocation.routeGroup !== 'all' && (
        <div className="mx-4 mt-2 mb-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2.5">
          <p className="text-[13px] font-bold text-[#087a4b]">{uiText(`Shops in ${userLocation.area}`)}</p>
          <p className="text-[11px] text-gray-500">{uiText("Showing shops assigned to this area’s routes.")}</p>
        </div>
      )}

      {/* Shop Cards Grid */}
      <div className="glass-merchants ae-shop-grid pt-3 pb-8">
        {isError ? (
          <div role="alert" className="col-span-2 py-12 text-center">
            <p className="text-gray-600 text-sm">{uiText('Unable to load shops.')}</p>
            <button
              onClick={() => void refetch()}
              className="mt-3 px-4 py-1.5 rounded-full bg-[#087a4b] text-white text-xs font-bold"
            >
              {uiText('Retry')}
            </button>
          </div>
        ) : isLoading ? (
          <div className="col-span-2 py-12 text-center text-gray-400 text-sm">{uiText("Loading merchants...")}</div>
        ) : displayedMerchants.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-gray-400 text-sm">
            {uiText("No merchants found")}{search ? ` for "${search}"` : ''}.
          </div>
        ) : (
          displayedMerchants.map(merchant => (
            <CustomerShopCard
              key={merchant.id}
              merchant={merchant}
              distance={distanceKm(merchant.latitude, merchant.longitude)}
              onOpen={() => void openMerchant(merchant)}
              favorite={favorites.includes(merchant.id)}
              onFavorite={() => toggleFavorite(merchant.id)}
            />
          ))
        )}
      </div>

      {/* Detail Merchant Modal */}
      {detailMerchant ? (
        <div className="fixed inset-0 z-[100] grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-5" onClick={() => setDetailMerchant(null)}>
          <section className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-28 sm:rounded-3xl sm:pb-5" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{detailMerchant.merchant_name}</h2>
                <p className="text-sm text-gray-500">{detailMerchant.category || 'AE Merchant'}</p>
                <p className="mt-1 text-sm font-bold text-[#3158f5]">
                  {distanceKm(detailMerchant.latitude, detailMerchant.longitude)?.toFixed(1) || '—'}{uiText(" km away")}
                </p>
              </div>
              <button onClick={() => setDetailMerchant(null)} className="text-2xl text-gray-400">×</button>
            </div>
            {detailMerchant.latitude != null && detailMerchant.longitude != null ? (
              <a className="mb-5 block rounded-xl bg-[#0066f4] hover:bg-[#0052cc] px-4 py-3 text-center font-bold text-white shadow-sm transition-colors" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${detailMerchant.latitude},${detailMerchant.longitude}`}>
                {uiText("Get directions")}
              </a>
            ) : null}
            <p className="text-sm text-gray-600">{detailMerchant.address}</p>
            <div className="ae-shop-gallery">
              {Array.from(new Set([detailMerchant.image_url, ...(detailMerchant.images || [])].filter((image): image is string => !!image))).map(image => (
                <a key={image} href={image} target="_blank" rel="noopener noreferrer">
                  <img src={image} alt={`${detailMerchant.merchant_name} shop photo`} loading="lazy" />
                </a>
              ))}
            </div>
            <h3 className="mb-2 font-bold">{uiText("Write a review")}</h3>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setReviewRating(star)} className={`text-2xl ${star <= reviewRating ? 'text-amber-400' : 'text-gray-300'}`}>
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={reviewMessage}
              onChange={event => setReviewMessage(event.target.value)}
              placeholder={uiText("Share your experience")}
              className="mt-2 min-h-20 w-full rounded-xl border border-gray-200 p-3 text-sm"
            />
            {reviewError && <p role="alert" className="text-sm text-red-600">{reviewError}</p>}
            <button
              disabled={reviewBusy || reviewMessage.trim().length < 2}
              onClick={() => void submitReview()}
              className="mt-2 rounded-xl bg-[#3158f5] px-4 py-2 text-sm font-bold text-white"
            >
              {uiText("Submit review")}
            </button>
            <h3 className="mb-2 mt-6 font-bold">{uiText("Customer reviews")}</h3>
            {reviews.length ? (
              reviews.map(review => (
                <div key={review.id} className="border-b border-gray-100 py-3">
                  <div className="text-amber-400">
                    {'★'.repeat(review.rating || 0)}
                    <span className="ml-2 text-xs text-gray-500">{review.customerName}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{review.message}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">{uiText("No reviews yet.")}</p>
            )}
          </section>
        </div>
      ) : null}

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex justify-between items-center pt-4 pb-6 px-5">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-full text-sm font-bold disabled:opacity-50"
          >
            {uiText(" Previous ")}
          </button>
          <span className="text-sm text-gray-500 font-medium">
            {uiText("Page ")}{page}{uiText(" of ")}{data.pagination.totalPages}
          </span>
          <button
            disabled={page === data.pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-full text-sm font-bold disabled:opacity-50"
          >
            {uiText(" Next ")}
          </button>
        </div>
      )}
    </div>
  );
}
