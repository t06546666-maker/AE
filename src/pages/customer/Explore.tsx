import { CustomerShopCard } from '../../components/CustomerShopCard';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, ChevronRight, X, Heart } from 'lucide-react';
import { useCustomerMerchants, useCustomerCategories } from '../../hooks/useCustomerData';
import { useEffect, useState } from 'react';
import { CustomerNearbyMap } from '../../components/CustomerNearbyMap';
import { Geolocation } from '@capacitor/geolocation';
import { apiFetch } from '../../api';



export function CustomerExplore() {
  const routeLocation = useLocation();
  const [reviewError, setReviewError] = useState(''); const [reviewBusy, setReviewBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem('ae_favorite_merchants') || '[]'));
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detailMerchant, setDetailMerchant] = useState<typeof merchants[number] | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);

  const categoriesQuery = useCustomerCategories();
  const { data, isLoading } = useCustomerMerchants(page, search, selectedCategory);
  const merchants = data?.merchants ?? [];
  const distanceKm = (latitude?: number | null, longitude?: number | null) => {
    if (!userLocation || latitude == null || longitude == null) return null;
    const rad = Math.PI / 180;
    const dLat = (latitude - userLocation.latitude) * rad;
    const dLon = (longitude - userLocation.longitude) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLocation.latitude * rad) * Math.cos(latitude * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const sortedMerchants = [...merchants].sort((a, b) => (distanceKm(a.latitude, a.longitude) ?? Number.POSITIVE_INFINITY) - (distanceKm(b.latitude, b.longitude) ?? Number.POSITIVE_INFINITY));
  const locateUser = async () => {
    try {
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== 'granted') return;
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000 });
      setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch { /* location is optional; merchants remain visible without distances */ }
  };
  useEffect(() => { void locateUser(); }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'AE';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (index: number) => {
    const colors = ['bg-green-100 text-green-700', 'bg-amber-100 text-amber-700', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700'];
    return colors[index % colors.length];
  };

  const handleSearchToggle = () => {
    if (searchOpen) {
      setSearchOpen(false);
      setInputValue('');
      setSearch('');
      setPage(1);
    } else {
      setSearchOpen(true);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputValue);
    setPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    // Pass category as search hint when not 'All'
    if (cat !== 'All') {
      setSelectedCategory(cat); setSearch(inputValue);
    } else {
      setSearch(inputValue);
    }
    setPage(1);
  };
  const toggleFavorite = (id: string) => setFavorites(current => { const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id]; localStorage.setItem('ae_favorite_merchants', JSON.stringify(next)); return next; });
  const openMerchant = async (merchant: typeof merchants[number]) => { setReviewMessage(''); setReviewRating(5); setReviews([]); setDetailMerchant(merchant); setSelectedMerchantId(merchant.id); document.getElementById('customer-nearby-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { const result = await apiFetch<{ reviews: any[] }>(`/api/customer/merchant-reviews/${merchant.id}`); setReviews(result.reviews || []); } catch { setReviews([]); } };
  const submitReview = async () => { if (!detailMerchant || reviewBusy || reviewMessage.trim().length < 2) return; setReviewBusy(true); setReviewError(''); try { await apiFetch('/api/customer/feedback', { method: 'POST', body: JSON.stringify({ feedback_type: 'merchant', merchant_id: detailMerchant.id, rating: reviewRating, message: reviewMessage.trim() }) }); setReviewMessage(''); const result = await apiFetch<{ reviews: any[] }>(`/api/customer/merchant-reviews/${detailMerchant.id}`); setReviews(result.reviews || []); } catch (error) { setReviewError((error as Error).message); } finally { setReviewBusy(false); } };
  useEffect(() => { const merchant = routeLocation.state?.merchant; if (merchant?.id) void openMerchant(merchant); }, [routeLocation.key]);

  return (
    <div className="customer-modern-page bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/home"><ArrowLeft size={24} /></Link>
          <h1 className="text-lg font-bold">Nearby Merchants</h1>
        </div>
        <button onClick={handleSearchToggle} className="text-gray-800">
          {searchOpen ? <X size={24} /> : <Search size={24} />}
        </button>
      </header>

      {/* Search Bar */}
      {searchOpen && (
        <form onSubmit={handleSearchSubmit} className="px-5 pt-3 pb-1 bg-white border-b border-gray-100">
          <input
            autoFocus
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onBlur={() => { setSearch(inputValue); setPage(1); }}
            placeholder="Search merchants..."
            className="w-full bg-gray-50 border border-gray-200 rounded-[12px] px-4 py-2.5 text-[14px] font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#087a4b] focus:ring-1 focus:ring-[#087a4b] transition-all"
          />
        </form>
      )}

      {/* Categories */}
      <div className="px-5 pt-6 pb-2">
        <div className="glass-categories flex overflow-x-auto space-x-2 pb-2 scrollbar-hide -mx-5 px-5">
          <button
            onClick={() => handleCategoryChange('All')}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
              activeCategory === 'All'
                ? 'bg-[#087a4b] text-white shadow-md shadow-green-600/20'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {categoriesQuery.data?.categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                activeCategory === cat.id
                  ? 'bg-[#087a4b] text-white shadow-md shadow-green-600/20'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <CustomerNearbyMap merchants={merchants} selectedMerchantId={selectedMerchantId} />
      <div className="mx-5 mb-3 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <div><p className="text-[13px] font-bold text-[#087a4b]">Merchants near you</p><p className="text-[11px] text-gray-500">Sorted by distance from your current location</p></div>
        <button type="button" onClick={() => void locateUser()} className="rounded-full bg-white px-3 py-2 text-[11px] font-bold text-[#087a4b] shadow-sm">Update location</button>
      </div>

      {/* Merchant List */}
      <div className="glass-merchants ae-shop-grid">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Loading merchants...</div>
        ) : merchants.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No merchants found{search ? ` for "${search}"` : ''}.</div>
        ) : (
          sortedMerchants.map(merchant => <CustomerShopCard key={merchant.id} merchant={merchant} onOpen={() => void openMerchant(merchant)} favorite={favorites.includes(merchant.id)} onFavorite={() => toggleFavorite(merchant.id)} distance={distanceKm(merchant.latitude, merchant.longitude)} />)
        )}
      </div>

      {detailMerchant ? <div className="fixed inset-0 z-[100] grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-5" onClick={() => setDetailMerchant(null)}><section className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-28 sm:rounded-3xl sm:pb-5" onClick={event => event.stopPropagation()}><div className="mb-4 flex items-start justify-between"><div><h2 className="text-xl font-bold">{detailMerchant.merchant_name}</h2><p className="text-sm text-gray-500">{detailMerchant.category || 'AE Merchant'}</p><p className="mt-1 text-sm font-bold text-[#3158f5]">{distanceKm(detailMerchant.latitude, detailMerchant.longitude)?.toFixed(1) || '—'} km away</p></div><button onClick={() => setDetailMerchant(null)} className="text-2xl text-gray-400">×</button></div>{detailMerchant.latitude != null && detailMerchant.longitude != null ? <a className="mb-5 block rounded-xl bg-[#087a4b] px-4 py-3 text-center font-bold text-white" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${detailMerchant.latitude},${detailMerchant.longitude}`}>Get directions</a> : null}<p className="text-sm text-gray-600">{detailMerchant.address}</p><div className="ae-shop-gallery">{Array.from(new Set([detailMerchant.image_url, ...(detailMerchant.images || [])].filter((image): image is string => !!image))).map(image => <a key={image} href={image} target="_blank" rel="noopener noreferrer"><img src={image} alt={`${detailMerchant.merchant_name} shop photo`} loading="lazy" /></a>)}</div><h3 className="mb-2 font-bold">Write a review</h3><div className="flex gap-1">{[1,2,3,4,5].map(star => <button key={star} onClick={() => setReviewRating(star)} className={`text-2xl ${star <= reviewRating ? 'text-amber-400' : 'text-gray-300'}`}>★</button>)}</div><textarea value={reviewMessage} onChange={event => setReviewMessage(event.target.value)} placeholder="Share your experience" className="mt-2 min-h-20 w-full rounded-xl border border-gray-200 p-3 text-sm" />{reviewError && <p role="alert" className="text-sm text-red-600">{reviewError}</p>}<button disabled={reviewBusy || reviewMessage.trim().length < 2} onClick={() => void submitReview()} className="mt-2 rounded-xl bg-[#3158f5] px-4 py-2 text-sm font-bold text-white">Submit review</button><h3 className="mb-2 mt-6 font-bold">Customer reviews</h3>{reviews.length ? reviews.map(review => <div key={review.id} className="border-b border-gray-100 py-3"><div className="text-amber-400">{'★'.repeat(review.rating || 0)}<span className="ml-2 text-xs text-gray-500">{review.customerName}</span></div><p className="mt-1 text-sm text-gray-700">{review.message}</p></div>) : <p className="text-sm text-gray-500">No reviews yet.</p>}</section></div> : null}

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex justify-between items-center pt-4 pb-6 px-5">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-full text-sm font-bold disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 font-medium">Page {page} of {data.pagination.totalPages}</span>
          <button
            disabled={page === data.pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-full text-sm font-bold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

