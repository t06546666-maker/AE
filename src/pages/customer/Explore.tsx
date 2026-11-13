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

export function CustomerExplore(_props: {userId?: string}) {
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
    <div className="customer-modern-page bg-[#f4f9fd] min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Top Header Bar with Back Arrow, Location Dropdown, and Map Toggle */}
      <header className="ae-explore-header">
        <Link to="/customer/home" className="ae-explore-back" aria-label={uiText("Back to Home")}>
          <ArrowLeft size={20} />
        </Link>
        <div className="ae-explore-location">
          <CustomerLocationBar compact defaultAll />
        </div>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          className={`ae-explore-map-btn ${showMap ? 'active' : ''}`}
          aria-label={uiText("Toggle map view")}
        >
          <Map size={15} />
          <span>{showMap ? uiText("List") : uiText("Map")}</span>
        </button>
      </header>

      {/* Hero Section: Customer Waves & Blue Theme directly behind Search & Categories */}
      <div className="ae-explore-hero">
        {/* Search Bar - Floating white card on blue wave canvas */}
        <div className="ae-explore-search-wrap">
          <Search size={18} className="ae-explore-search-icon" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={uiText("Search shops near you...")}
            className="ae-explore-search-input"
          />
          {inputValue ? (
            <button
              type="button"
              onClick={() => {
                setInputValue('');
                setSearch('');
                setPage(1);
              }}
              className="ae-explore-search-clear"
              aria-label={uiText("Clear search")}
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        {/* Horizontal Scrolling Categories - AE Blue Gradient for Active */}
        <div className="ae-explore-categories">
          <button
            key="all"
            type="button"
            onClick={() => handleCategoryChange('All')}
            className={`ae-category-pill ${activeCategory === 'All' ? 'active' : ''}`}
          >
            {uiText("All")}
          </button>
          {categoriesQuery.data?.categories?.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.id)}
              className={`ae-category-pill ${activeCategory === cat.id ? 'active' : ''}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Quick Filter Chips (All, Nearby, Open now) */}
        <div className="ae-explore-filters">
          <button
            type="button"
            onClick={() => setQuickFilter('all')}
            className={`ae-filter-pill ${quickFilter === 'all' ? 'active' : ''}`}
          >
            {uiText("All")}
          </button>
          <button
            type="button"
            onClick={() => setQuickFilter('nearby')}
            className={`ae-filter-pill ${quickFilter === 'nearby' ? 'active' : ''}`}
          >
            {uiText("Nearby")}
          </button>
          <button
            type="button"
            onClick={() => setQuickFilter('open')}
            className={`ae-filter-pill ${quickFilter === 'open' ? 'active' : ''}`}
          >
            {uiText("Open now")}
          </button>
        </div>
      </div>

      {/* GPS Location Prompt Banner if not yet granted */}
      {currentLocation.data?.latitude == null && (
        <div className="ae-explore-gps-banner">
          <p>{uiText("Tap to use live GPS for exact distance from you")}</p>
          <button type="button" onClick={requestLiveLocation}>
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
