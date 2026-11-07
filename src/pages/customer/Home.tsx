import { uiText } from '../../uiText';
import { formatDateTime } from '../../utils';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import QRCode from 'qrcode';
import { Bell, ChevronRight, Gift, Languages, MapPin, Star, ListPlus, X, ShoppingBag, QrCode, Tags, User, Sparkles, History, TrendingUp, Wallet, ArrowUpRight, Heart, HelpCircle, ArrowRight } from 'lucide-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../../types';
import { useCustomerDashboard, useCustomerOffers } from '../../hooks/useCustomerData';
import { useCustomerLocation } from '../../hooks/useCustomerLocation';
import { apiFetch } from '../../api';
import { useDailyGreeting } from '../../dailyGreeting';
import { CustomerLocationBar } from '../../components/CustomerLocationBar';
import { CustomerAds } from '../../components/CustomerAds';
import { CustomerOfferPreviewModal, type PreviewOfferData } from '../../components/CustomerOfferPreviewModal';
import './home-reference.css';
import { ProductListPanel } from '../../components/ProductListPanel';
import { MilestoneVoucherCard } from '../../components/MilestoneVoucherCard';

export function CustomerHome({ user }: { user: UserProfile }) {
  const customerLocation = useCustomerLocation(true, true);
  const dailyGreeting = useDailyGreeting('customer');
  const { data, isLoading } = useCustomerDashboard();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const rewardPoints = data?.reward_points ?? 0;
  const formattedPoints = rewardPoints.toLocaleString('en-IN');
  const activity = data?.activity ?? [];
  const [qrSrc, setQrSrc] = useState('');
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [howToUseOpen, setHowToUseOpen] = useState(false);
  const [activeAdSlide, setActiveAdSlide] = useState(0);
  const [selectedOffer, setSelectedOffer] = useState<PreviewOfferData | null>(null);
  const [productListOpen, setProductListOpen] = useState(false);
  const [productRequestId, setProductRequestId] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [productList, setProductList] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productListMessage, setProductListMessage] = useState('');
  const [loadSecondaryContent, setLoadSecondaryContent] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoadSecondaryContent(true), 1800);
    return () => window.clearTimeout(timer);
  }, []);
  const [merchantSearch, setMerchantSearch] = useState('');
  const merchantDirectory = useInfiniteQuery({
    queryKey: ['product-list-merchants', user.id, merchantSearch],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => apiFetch<{ merchants: { id: string; merchant_name: string }[]; pagination: { page: number; totalPages: number } }>(`/api/customer/merchants?${new URLSearchParams({ page: String(pageParam), pageSize: '20', search: merchantSearch })}`, { signal }),
    getNextPageParam: last => last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    enabled: productListOpen,
  });
  const { data: offersData, isLoading: offersQueryLoading } = useCustomerOffers(loadSecondaryContent, customerLocation.data);
  const offersLoading = !loadSecondaryContent || offersQueryLoading;
  const offers = (offersData?.offers || []).slice(0, 16);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ae_favorite_offers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (offerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(offerId)
        ? prev.filter((id) => id !== offerId)
        : [...prev, offerId];
      try {
        localStorage.setItem('ae_favorite_offers', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const filteredOffers = useMemo(() => {
    if (selectedCategory === 'all') return offers;
    return offers.filter((o) => (o.category || '').toLowerCase().includes(selectedCategory.toLowerCase()));
  }, [offers, selectedCategory]);

  const nearbyOffers = useMemo(() => {
    return offers.slice(0, 8);
  }, [offers]);

  const categoryDefaultImages: Record<string, string> = {
    supermarket: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    restaurant: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
    bakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    fashion: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80',
    health: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    electronics: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=600&q=80',
  };

  const getOfferPhoto = (offer?: { imageUrl?: string; category?: string }, idx = 0): string => {
    if (offer?.imageUrl) return offer.imageUrl;
    const cat = (offer?.category || '').toLowerCase();
    for (const [key, url] of Object.entries(categoryDefaultImages)) {
      if (cat.includes(key)) return url;
    }
    const urls = Object.values(categoryDefaultImages);
    return urls[idx % urls.length];
  };

  const getOfferDiscountTag = (idx = 0): string => {
    const tags = ['20% OFF', '10% OFF', '15% OFF', '25% OFF', 'SPECIAL DEAL'];
    return tags[idx % tags.length];
  };

  useEffect(() => {
    if (offers.length <= 1) return;
    const interval = setInterval(() => {
      setActiveAdSlide((prev) => (prev + 1) % Math.min(offers.length, 5));
    }, 4500);
    return () => clearInterval(interval);
  }, [offers.length]);
  const merchants = merchantDirectory.data?.pages.flatMap(page => page.merchants) || [];
  const location = useLocation();
  useEffect(() => { if (new URLSearchParams(location.search).get('productList') === '1') { setProductRequestId(new URLSearchParams(location.search).get('requestId') || ''); setProductListOpen(true); window.history.replaceState({}, '', '/customer/home'); } }, [location.search]);
  const submitProductList = useMutation({ mutationFn: async () => { const form = new FormData(); form.append('merchant_id', merchantId); if (productList.trim()) form.append('product_list', productList.trim()); if (pickupTime.trim()) form.append('pickup_time', pickupTime.trim()); if (productImage) form.append('image', productImage); return apiFetch('/api/customer/product-list-requests', { method: 'POST', body: form }); }, onSuccess: () => { setProductListMessage('Your product list was sent to the selected merchant.'); setProductList(''); setPickupTime(''); setProductImage(null); setMerchantId(''); void queryClient.invalidateQueries({ queryKey: ['customer-product-lists'] }); } });
  const { data: productHistory, isPending: historyLoading, isError: historyError, refetch: retryHistory } = useQuery({ queryKey: ['customer-product-lists', user.id], queryFn: () => apiFetch<{ requests: Array<{ id: string; product_list?: string; image_url?: string; status: string; created_at: string; pickup_time?: string; merchants?: { name?: string } }> }>('/api/customer/product-list-requests'), enabled: productListOpen, refetchInterval: productListOpen ? 15000 : false });

  const heroPointsRef = useRef<HTMLDivElement>(null);
  const [showStickyPoints, setShowStickyPoints] = useState(false);

  // Monitor when the top Hero Points Card scrolls out of view so the floating bottom pill smoothly appears
  useEffect(() => {
    const handleScroll = () => {
      if (!heroPointsRef.current) {
        setShowStickyPoints(window.scrollY > 200);
        return;
      }
      const rect = heroPointsRef.current.getBoundingClientRect();
      // When the bottom of the hero points card scrolls past the header (~75px)
      setShowStickyPoints(rect.bottom < 75);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(JSON.stringify({ id: user.customer_code || user.id, transactionMode: 'earn' }), { width: 220, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((src) => { if (active) setQrSrc(src); })
      .catch(() => { if (active) setQrSrc(''); });
    return () => { active = false; };
  }, [user.id, user.customer_code]);

  const getInitials = (name?: string) => {
    if (!name) return 'AE';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (index: number) => {
    const colors = ['bg-[#22c55e]', 'bg-[#d97706]', 'bg-[#0ea5e9]', 'bg-[#c026d3]', 'bg-[#f43f5e]'];
    return colors[index % colors.length];
  };

  return (
    <div className="customer-modern-page ae-reference-home bg-white min-h-screen text-gray-900 font-sans pb-[180px]">
      {/* Header */}
      <header className="customer-modern-topbar flex justify-between items-center px-4 py-4 bg-white sticky top-0 z-10">
        <img src="/logo.png" alt={uiText("AE")} className="customer-home-logo object-contain" style={{ width: 83, height: 48 }} />
        <CustomerLocationBar compact />
        <Link to="/customer/profile" aria-label={uiText("Profile")}><User size={24} /></Link>
        <Link to="/customer/notifications" className="relative text-gray-800">
          <Bell size={24} />
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-[1.5px] border-white"></span>
        </Link>
      </header>

      <div className="px-4 pt-1 space-y-3.5">

        {/* 1. Customer Greeting & Language Selector (Directly Opposite) */}
        <div className="customer-modern-greeting flex items-center justify-between gap-2 pt-1">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold text-gray-900 flex items-center gap-1.5 leading-tight">
              {uiText("Hi, ")}{user.name?.split(' ')[0] || user.phone || uiText("User")}! <span className="text-[20px]">👋</span>
            </h2>
            <button
              type="button"
              onClick={() => setHowToUseOpen(true)}
              className="group inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 active:text-blue-800 transition-colors mt-0.5 focus:outline-none cursor-pointer"
            >
              <HelpCircle size={12} className="text-blue-500 group-hover:scale-110 transition-transform" />
              <span className="underline underline-offset-2">{uiText("How we use AE?")}</span>
              <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
          <div className="ae-home-language shrink-0">
            <label className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-gray-700 shadow-2xs cursor-pointer hover:bg-gray-50 transition-colors" title={t('language.malayalam')}>
              <Languages size={11} className="text-blue-600" />
              <select
                className="border-0 bg-transparent p-0 text-[10px] font-bold outline-none cursor-pointer text-gray-800"
                value={i18n.language.startsWith('ml') ? 'ml' : 'en'}
                onChange={(event) => void i18n.changeLanguage(event.target.value)}
                aria-label={t('language.malayalam')}
              >
                <option value="en">EN</option>
                <option value="ml">മല</option>
              </select>
            </label>
          </div>
        </div>

        {/* 2. One Sliding Offer Banner (Visual Photo Ad, Auto-sliding) */}
        <section className="pt-0.5">
          <div
            onClick={() => {
              const current = offers[activeAdSlide] || offers[0];
              if (current) {
                setSelectedOffer({
                  id: current.id,
                  title: current.title,
                  description: current.description,
                  imageUrl: getOfferPhoto(current, activeAdSlide),
                  merchantName: current.merchant_raw_name || current.merchant_name,
                  merchantPhone: current.merchant_phone,
                  merchantAddress: current.merchant_address,
                  category: current.category,
                  expiresAt: current.expires_at,
                });
              }
            }}
            className="hero-ad-realistic rounded-2xl text-white shadow-xl cursor-pointer group active:scale-[0.99] transition-all relative overflow-hidden min-h-[120px]"
          >
            {/* Visual Photo Background */}
            <div className="absolute inset-0 z-0">
              <img
                src={getOfferPhoto(offers[activeAdSlide], activeAdSlide)}
                alt={offers[activeAdSlide]?.title || 'Featured Offer'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-[0.4]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
            </div>

            <div className="relative z-10 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
                  <span>{uiText(getOfferDiscountTag(activeAdSlide))}</span>
                </span>
                <span className="text-[11px] font-bold text-cyan-200 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full">
                  {offers[activeAdSlide]?.category || uiText("Partner Stores")}
                </span>
              </div>

              <div>
                <span className="text-xs font-bold text-sky-300 block">
                  {offers[activeAdSlide]?.merchant_name || uiText("AE Partner Store")}
                </span>
                <h3 className="text-sm font-black tracking-tight text-white line-clamp-1 mt-0.5">
                  {offers[activeAdSlide]?.title || uiText("Special Offers & Deals")}
                </h3>
                <p className="text-[11px] text-sky-100/90 line-clamp-1 mt-0.5 font-medium">
                  {offers[activeAdSlide]?.description || uiText("Shop with AE QR & earn points on every purchase")}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
                <span className="text-amber-300 font-bold flex items-center gap-1 text-[11px]">
                  <span>{uiText("Tap to View Offer")}</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </span>
                <div className="flex items-center gap-1">
                  {offers.slice(0, 5).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${activeAdSlide === i ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/40'}`}
                    ></span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Hero Points Section (Radiant Blue Theme, Compact) */}
        <section ref={heroPointsRef}>
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0c2e68] via-[#081f48] to-[#040f26] text-white p-2.5 shadow-xl shadow-blue-950/20 border border-blue-500/40 space-y-2">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-cyan-400/20 blur-xl pointer-events-none"></div>

            {/* Top Row: Label & Small Points Number + History Link */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">★</span>
                <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wide">
                  {uiText("Available Points:")}
                </span>
                <span className="text-sm font-black text-white tracking-tight">
                  {isLoading ? '...' : formattedPoints}
                </span>
                <span className="text-[9px] font-bold text-cyan-300 uppercase">
                  {uiText("pts")}
                </span>
              </div>

              <Link
                to="/customer/transactions"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-100 hover:text-white bg-white/10 hover:bg-white/15 px-2 py-0.5 rounded-lg border border-white/15 transition-colors"
                title={uiText("Points History")}
              >
                <History size={12} />
                <span>{uiText("History")}</span>
                <ChevronRight size={11} className="text-cyan-300" />
              </Link>
            </div>

            {/* Core Action Buttons: Claim Points (Scan QR) & Redeem Points (Scan QR) */}
            <div className="relative z-10 grid grid-cols-2 gap-2">
              {/* Button 1: Claim Points */}
              <button
                type="button"
                onClick={() => setClaimModalOpen(true)}
                className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 active:scale-[0.98] text-white font-bold text-xs py-2 px-2.5 rounded-xl transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 group"
              >
                <QrCode size={15} className="group-hover:scale-110 transition-transform text-white shrink-0" />
                <div className="text-left leading-tight">
                  <span className="block font-black text-[11px]">{uiText("Claim Points")}</span>
                  <span className="block text-[9px] text-blue-100 font-medium">{uiText("Scan QR Code")}</span>
                </div>
              </button>

              {/* Button 2: Redeem Points */}
              <Link
                to="/customer/shop-scan?mode=redeem"
                className="bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white font-bold text-xs py-2 px-2.5 rounded-xl border border-white/20 transition-all shadow-xs flex items-center justify-center gap-1.5 group"
              >
                <QrCode size={15} className="group-hover:scale-110 transition-transform text-cyan-300 shrink-0" />
                <div className="text-left leading-tight">
                  <span className="block font-black text-[11px]">{uiText("Redeem Points")}</span>
                  <span className="block text-[9px] text-sky-200 font-medium">{uiText("Scan QR Code")}</span>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* 3B. Milestone Gift Vouchers Card (Better UI for 1st Transaction Gift) */}
        <section className="pt-0.5">
          <MilestoneVoucherCard
            customerName={user.name?.split(' ')[0] || user.phone || 'Customer'}
            compact
          />
        </section>

        {/* 4. Nearby Best Offers (Top-Rated Partner Deals Near Chittur with Photos) */}
        <section className="space-y-2.5 pt-1">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>⭐</span>
                <span>{uiText("Nearby Best Offers")}</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {uiText("Top discounts and offers close to you")}
              </p>
            </div>
            <Link to="/customer/explore" className="text-xs font-bold text-blue-600 hover:underline">
              {uiText("Explore →")}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {offers.slice(0, 2).map((offer, idx) => {
              const photo = getOfferPhoto(offer, idx);
              const tag = getOfferDiscountTag(idx);
              return (
                <div
                  key={`best-offer-${offer.id}-${idx}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOffer({
                    id: offer.id,
                    title: offer.title,
                    description: offer.description,
                    imageUrl: photo,
                    merchantName: offer.merchant_raw_name || offer.merchant_name,
                    merchantPhone: offer.merchant_phone,
                    merchantAddress: offer.merchant_address,
                    category: offer.category,
                    expiresAt: offer.expires_at,
                  })}
                  className="relative rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative h-[95px] overflow-hidden bg-slate-100">
                    <img src={photo} alt={offer.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"></div>
                    <span className="absolute top-2 left-2 bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-xs">
                      {uiText(tag)}
                    </span>
                    <span className="absolute bottom-1.5 left-2 text-[10px] text-cyan-300 font-bold">{uiText(" 📍 Nearby ")}</span>
                  </div>
                  <div className="p-2.5 space-y-1">
                    <h4 className="font-bold text-xs text-slate-900 leading-tight line-clamp-1">{offer.merchant_name || uiText("AE Partner Store")}</h4>
                    <p className="text-[11px] text-gray-500 line-clamp-1 font-medium">{offer.title}</p>
                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-gray-100 text-blue-600 font-bold">
                      <span>{uiText("View Deal")}</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. Nearby Partner Offers & Shops (Real Store Photos) */}
        <section className="space-y-2.5 pt-1">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>📍</span>
                <span>{uiText("Nearby Offers & Shops")}</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {uiText("Discounts & deals at stores in Chittur & Palakkad")}
              </p>
            </div>
            <Link to="/customer/explore" className="text-xs font-bold text-blue-600 hover:underline">
              {uiText("View Map →")}
            </Link>
          </div>

          <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-0.5 hide-scrollbar snap-x">
            {nearbyOffers.map((offer, idx) => {
              const photo = getOfferPhoto(offer, idx + 2);
              const tag = getOfferDiscountTag(idx + 1);
              return (
                <div
                  key={`nearby-${offer.id}-${idx}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOffer({
                    id: offer.id,
                    title: offer.title,
                    description: offer.description,
                    imageUrl: photo,
                    merchantName: offer.merchant_raw_name || offer.merchant_name,
                    merchantPhone: offer.merchant_phone,
                    merchantAddress: offer.merchant_address,
                    category: offer.category,
                    expiresAt: offer.expires_at,
                  })}
                  className="w-[200px] shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative h-[95px] overflow-hidden bg-slate-100">
                    <img src={photo} alt={offer.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"></div>
                    <span className="absolute top-2 left-2 bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-xs">
                      {uiText(tag)}
                    </span>
                    <span className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-cyan-300 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                      📍 {offer.distance ? `${offer.distance.toFixed(1)} km` : uiText("Chittur")}
                    </span>
                    <div className="absolute bottom-1.5 left-2 right-2">
                      <h4 className="font-bold text-xs text-white leading-tight line-clamp-1">{offer.merchant_name || uiText("AE Partner Store")}</h4>
                    </div>
                  </div>
                  <div className="p-2.5 flex items-center justify-between text-[10px] bg-white border-t border-gray-50">
                    <span className="text-gray-500 truncate max-w-[95px]">{offer.merchant_address || "Main Road"}</span>
                    <span className="text-blue-600 font-bold">{uiText("View →")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 6. Category-Wise Offers */}
        <section className="space-y-3 pt-1">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>🏷️</span>
                <span>{uiText("Category Offers")}</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {uiText("Browse deals by partner category")}
              </p>
            </div>
          </div>

          {/* Deal Categories Quick Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 hide-scrollbar">
            {[
              { id: 'all', label: 'All Deals', icon: '🔥' },
              { id: 'supermarket', label: 'Supermarkets', icon: '🛒' },
              { id: 'restaurant', label: 'Food & Cafes', icon: '🍽️' },
              { id: 'fashion', label: 'Fashion', icon: '👕' },
              { id: 'health', label: 'Health', icon: '💊' },
              { id: 'electronics', label: 'Electronics', icon: '📱' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-xs scale-[1.02]'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
              >
                <span>{cat.icon}</span>
                <span>{uiText(cat.label)}</span>
              </button>
            ))}
          </div>

          {/* Category Deals Grid */}
          {offersLoading ? (
            <div className="rounded-2xl bg-gray-50 py-10 text-center text-sm text-gray-400 font-medium">
              {uiText("Loading exciting partner offers...")}
            </div>
          ) : filteredOffers.length ? (
            <div className="grid grid-cols-2 gap-2.5">
              {filteredOffers.map((offer, idx) => {
                const photo = getOfferPhoto(offer, idx);
                const tag = getOfferDiscountTag(idx);
                return (
                  <div
                    key={offer.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedOffer({
                      id: offer.id,
                      title: offer.title,
                      description: offer.description,
                      imageUrl: photo,
                      merchantName: offer.merchant_raw_name || offer.merchant_name,
                      merchantPhone: offer.merchant_phone,
                      merchantAddress: offer.merchant_address,
                      category: offer.category,
                      expiresAt: offer.expires_at,
                    })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedOffer({
                          id: offer.id,
                          title: offer.title,
                          description: offer.description,
                          imageUrl: photo,
                          merchantName: offer.merchant_raw_name || offer.merchant_name,
                          merchantPhone: offer.merchant_phone,
                          merchantAddress: offer.merchant_address,
                          category: offer.category,
                          expiresAt: offer.expires_at,
                        });
                      }
                    }}
                    className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div className="relative h-[105px] overflow-hidden bg-slate-100">
                      <img src={photo} alt={offer.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>
                      <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                        {uiText(tag)}
                      </span>
                    </div>
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="line-clamp-2 text-xs font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                          {offer.title}
                        </h4>
                        <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-blue-600">
                          {offer.merchant_name || uiText("AE Partner Store")}
                        </p>
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between text-[10px]">
                        <span className="text-gray-500 truncate max-w-[90px]">
                          {offer.merchant_address || uiText("Chittur")}
                        </span>
                        <span className="text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform">
                          {uiText("View →")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-6 text-center text-sm text-blue-900">
              <p className="font-bold">{uiText("No offers in this category right now")}</p>
              <button type="button" onClick={() => setSelectedCategory('all')} className="mt-2 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                {uiText("View All Offers")}
              </button>
            </div>
          )}
        </section>

        {/* 7. Trending Offers Carousel */}
        <section className="space-y-2.5 pt-1">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>⚡</span>
                <span>{uiText("Trending Offers")}</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {uiText("Swipe to explore special discounts")}
              </p>
            </div>
            <Link to="/customer/offers" className="text-xs font-bold text-blue-600 hover:underline">
              {uiText("View all →")}
            </Link>
          </div>

          {/* Horizontal Swipe Carousel */}
          <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-0.5 hide-scrollbar snap-x">
            {offers.map((offer, idx) => {
              const photo = getOfferPhoto(offer, idx + 3);
              const tag = getOfferDiscountTag(idx + 2);
              return (
                <div
                  key={`slide-${offer.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOffer({
                    id: offer.id,
                    title: offer.title,
                    description: offer.description,
                    imageUrl: photo,
                    merchantName: offer.merchant_raw_name || offer.merchant_name,
                    merchantPhone: offer.merchant_phone,
                    merchantAddress: offer.merchant_address,
                    category: offer.category,
                    expiresAt: offer.expires_at,
                  })}
                  className="w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative h-[105px] overflow-hidden bg-slate-100">
                    <img src={photo} alt={offer.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>
                    <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      {uiText(tag)}
                    </span>
                  </div>
                  <div className="p-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="line-clamp-1 text-xs font-bold text-gray-900">{offer.title}</h4>
                      <p className="line-clamp-1 text-[11px] font-semibold text-blue-600 mt-0.5">{offer.merchant_name || uiText("AE Partner Store")}</p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between text-[10px]">
                      <span className="text-gray-500 truncate max-w-[110px]">{offer.merchant_address || "Main Road"}</span>
                      <span className="text-blue-600 font-bold">{uiText("View →")}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 8. Favourite Offers (At the very end) */}
        <section className="space-y-2.5 pt-1">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span className="text-rose-500">❤️</span>
                <span>{uiText("Favourite Offers")}</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {uiText("Your saved & top customer-loved local deals")}
              </p>
            </div>
            <Link to="/customer/offers" className="text-xs font-bold text-blue-600 hover:underline">
              {uiText("Browse more →")}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {offers.slice(0, 4).map((offer, idx) => {
              const photo = getOfferPhoto(offer, idx + 1);
              const tag = getOfferDiscountTag(idx);
              const isFav = favorites.includes(offer.id) || idx === 0 || idx === 2;
              return (
                <div
                  key={`fav-${offer.id}-${idx}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOffer({
                    id: offer.id,
                    title: offer.title,
                    description: offer.description,
                    imageUrl: photo,
                    merchantName: offer.merchant_raw_name || offer.merchant_name,
                    merchantPhone: offer.merchant_phone,
                    merchantAddress: offer.merchant_address,
                    category: offer.category,
                    expiresAt: offer.expires_at,
                  })}
                  className="group relative overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative h-[95px] overflow-hidden bg-rose-50">
                    <img src={photo} alt={offer.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>
                    <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      {uiText(tag)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(offer.id, e)}
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-xs transition-transform active:scale-90 ${isFav ? 'bg-white text-rose-500' : 'bg-black/30 text-white hover:bg-black/50'
                        }`}
                      aria-label={uiText("Favorite")}
                    >
                      <Heart size={14} className={isFav ? 'fill-rose-500 text-rose-500' : ''} />
                    </button>
                  </div>
                  <div className="p-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="line-clamp-1 text-xs font-bold text-gray-900 leading-tight">
                        {offer.title}
                      </h4>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-gray-500 font-medium">
                        {offer.merchant_name || uiText("AE Partner Store")}
                      </p>
                    </div>
                    <div className="mt-2 pt-1 border-t border-rose-50 flex items-center justify-between text-[10px]">
                      <span className="text-blue-600 font-bold">
                        {uiText(tag)}
                      </span>
                      <span className="text-rose-600 font-bold group-hover:translate-x-0.5 transition-transform">
                        {uiText("View →")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {/* BEGIN: StickyFloatingPointsBar (Shows minimized when scrolling down past Hero Points) */}
      <aside
        aria-label={uiText("Points balance shortcut")}
        className={`fixed bottom-[calc(84px+env(safe-area-inset-bottom,16px))] md:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-[420px] z-40 transition-all duration-300 transform ${showStickyPoints ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
      >
        <div className="bg-slate-950/95 backdrop-blur-xl border border-blue-500/40 text-white rounded-2xl px-3.5 py-2.5 shadow-2xl shadow-blue-950/40 flex items-center justify-between gap-2.5 ring-1 ring-blue-500/20">
          {/* Live Points Compact Left */}
          <Link to="/customer/transactions" className="flex items-center gap-2 min-w-0 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center shadow-sm text-white font-black text-xs shrink-0 group-hover:scale-105 transition-transform">
              ★
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1 leading-none">
                <span className="text-sm font-black text-white tracking-tight">{isLoading ? '...' : formattedPoints}</span>
                <span className="text-[9px] font-black text-cyan-300 uppercase tracking-wide">{uiText("PTS")}</span>
              </div>
              <span className="text-[9px] text-sky-200/80 font-medium block mt-0.5">
                {uiText("Available Balance")}
              </span>
            </div>
          </Link>

          {/* Actions Right: Claim & Redeem & History */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick Claim Button */}
            <button
              type="button"
              onClick={() => setClaimModalOpen(true)}
              className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 active:scale-95 text-white text-xs font-black px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm shadow-blue-500/25"
              title={uiText("Claim Points on purchase")}
            >
              <QrCode size={13} />
              <span>{uiText("Claim")}</span>
            </button>

            {/* Quick Redeem Button */}
            <Link
              to="/customer/shop-scan?mode=redeem"
              className="bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-black px-2.5 py-1.5 rounded-xl border border-white/20 transition-all flex items-center gap-1 shadow-xs"
              title={uiText("Redeem Points")}
            >
              <Gift size={13} className="text-cyan-300" />
              <span>{uiText("Redeem")}</span>
            </Link>

            {/* History Shortcut */}
            <Link
              to="/customer/transactions"
              className="bg-white/10 hover:bg-white/20 active:scale-95 text-sky-200 hover:text-white p-1.5 rounded-xl border border-white/15 transition-all flex items-center justify-center"
              title={uiText("History")}
            >
              <History size={14} />
            </Link>
          </div>
        </div>
      </aside>
      {/* END: StickyFloatingPointsBar */}

      {/* BEGIN: Claim Points QR Modal */}
      {claimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 shadow-2xl text-center space-y-4">
            <button
              type="button"
              onClick={() => setClaimModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              aria-label={uiText("Close")}
            >
              <X size={18} />
            </button>

            <div className="space-y-1 pt-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black uppercase tracking-wider">
                {uiText("Earn Points On Purchase")}
              </span>
              <h3 className="text-lg font-black text-gray-900">{uiText("My Claim QR Code")}</h3>
              <p className="text-xs text-gray-500 font-medium">{user.full_name || user.phone || uiText("AE Customer")}</p>
            </div>

            {/* QR Code Container */}
            <div className="mx-auto w-[220px] h-[220px] bg-slate-50 border-2 border-blue-500/30 rounded-2xl p-2.5 shadow-inner flex items-center justify-center">
              {qrSrc ? (
                <img src={qrSrc} alt={uiText("Customer Claim QR")} className="w-full h-full object-contain rounded-xl" />
              ) : (
                <div className="animate-pulse bg-gray-200 w-full h-full rounded-xl"></div>
              )}
            </div>

            <div className="space-y-2">
              <span className="inline-block bg-slate-100 text-slate-800 font-mono font-bold text-xs px-3 py-1 rounded-lg">
                ID: {user.customer_code || user.id}
              </span>
              <p className="text-xs text-gray-600 font-medium px-2 leading-relaxed">
                {uiText("Show this QR to any AE partner store cashier at billing to claim points for your purchase!")}
              </p>
            </div>

            <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
              <Link
                to="/customer/shop-scan?mode=earn"
                className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all"
              >
                <QrCode size={15} />
                <span>{uiText("Or Scan Merchant Shop QR")}</span>
              </Link>
              <button
                type="button"
                onClick={() => setClaimModalOpen(false)}
                className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-800"
              >
                {uiText("Done")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* END: Claim Points QR Modal */}

      {/* START: How To Use AE Modal */}
      {howToUseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-5 shadow-2xl text-left space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 leading-tight">
                    {uiText("How we use AE?")}
                  </h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    {uiText("3 simple steps to earn & redeem")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHowToUseOpen(false)}
                className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
                aria-label={uiText("Close")}
              >
                <X size={16} />
              </button>
            </div>

            {/* 3 Step Guide Cards */}
            <div className="space-y-2.5">
              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50/70 border border-blue-100/80">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  1
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-gray-900">
                    {uiText("Shop at Local AE Partner Stores")}
                  </h4>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {uiText("Visit affiliated supermarkets, bakeries, clothing stores, and pharmacies in your locality.")}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100/80">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  2
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-gray-900">
                    {uiText("Show QR / Mobile Number at Billing")}
                  </h4>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {uiText("Show your Claim QR code or tell your mobile number to the cashier to instantly earn cashback reward points.")}
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100/80">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  3
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-gray-900">
                    {uiText("Redeem Rewards & WhatsApp Grocery Orders")}
                  </h4>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {uiText("Redeem points for discounts, claim milestone gifts, or send product grocery lists directly to shops via WhatsApp!")}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setHowToUseOpen(false);
                  setClaimModalOpen(true);
                }}
                className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <QrCode size={15} />
                <span>{uiText("View My Claim QR Code")}</span>
              </button>
              <button
                type="button"
                onClick={() => setHowToUseOpen(false)}
                className="w-full py-1 text-xs font-bold text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                {uiText("Got it, close")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* END: How To Use AE Modal */}

      <CustomerOfferPreviewModal offer={selectedOffer} onClose={() => setSelectedOffer(null)} />
      {productListOpen && <ProductListPanel requestId={productRequestId} name={user.full_name || uiText('Customer')} requests={productHistory?.requests || []} loading={historyLoading} historyError={historyError} retry={() => void retryHistory()} merchants={merchants} searchMerchants={setMerchantSearch} merchantsLoading={merchantDirectory.isFetching} merchantsError={merchantDirectory.isError} hasMoreMerchants={merchantDirectory.hasNextPage} loadMoreMerchants={() => void merchantDirectory.fetchNextPage()} retryMerchants={() => void merchantDirectory.refetch()} merchantId={merchantId} setMerchantId={setMerchantId} value={productList} setValue={setProductList} pickupTime={pickupTime} setPickupTime={setPickupTime} image={productImage} setImage={setProductImage} message={productListMessage} error={submitProductList.error ? (submitProductList.error as Error).message : ''} pending={submitProductList.isPending} send={() => submitProductList.mutate()} close={() => setProductListOpen(false)} />}
    </div>
  );
}
