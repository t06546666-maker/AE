import {categoryArtwork} from '../../categoryArtwork';
import {Capacitor} from '@capacitor/core';
import {OFFER_CATEGORIES,offerCategory} from '../../offerCategories';
import {homeSections,curatedOffers,carouselFor,type HomeLayout} from '../../customerHomeLayout';
import type {CustomerOffer} from '../../hooks/useCustomerData';
import {LanguageSelect} from '../../components/LanguageSelect';
import {useMerchantFavorites,importLegacyOfferFavorites} from '../../customerFavorites';
import {HomeBanners} from '../../components/HomeBanners';
import { uiText } from '../../uiText';
import { formatDateTime } from '../../utils';
import { useEffect, useState, useRef, useMemo, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Gift, Languages, MapPin, Star, ListPlus, X, ShoppingBag, QrCode, Tags, User, Sparkles, History, TrendingUp, Wallet, ArrowUpRight, Heart, HelpCircle, ArrowRight, Utensils, ShoppingCart, Shirt, HeartPulse, Headphones, Flame } from 'lucide-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../../types';
import { useCustomerDashboard, useCustomerOffers } from '../../hooks/useCustomerData';
import { useCustomerLocation } from '../../hooks/useCustomerLocation';
import { apiFetch } from '../../api';
import { useDailyGreeting } from '../../dailyGreeting';
import { CustomerLocationBar } from '../../components/CustomerLocationBar';
import { CustomerOfferPreviewModal, type PreviewOfferData } from '../../components/CustomerOfferPreviewModal';
import './home-reference.css';
import './nearby-discovery.css';
import { ProductListPanel } from '../../components/ProductListPanel';
import AOS from 'aos';
import 'aos/dist/aos.css';

export function CustomerHome({ user, preview = false, layoutOverride, offersOverride, carouselPlatform }: { user: UserProfile; preview?: boolean; layoutOverride?:HomeLayout; offersOverride?:CustomerOffer[]; carouselPlatform?:"web"|"app" }) {
  const [heroImage,setHeroImage] = useState('');
  const homeContent = useQuery({queryKey:['customer-home-content'],queryFn:()=>apiFetch<{content:HomeLayout}>('/api/customer/home-content'),refetchInterval:30000});
  const layout=layoutOverride||homeContent.data?.content;
  const sections=homeSections(layout);
  const sectionStyle=(id:string)=>({order:sections.findIndex(row=>row.id===id),display:sections.find(row=>row.id===id)?.visible===false?'none':undefined});
  const homeText = (key:string,fallback:string) => layout?.pageText?.[key] || uiText(fallback);
  const customerLocation = useCustomerLocation(!preview, !preview);
  const dailyGreeting = useDailyGreeting('customer');
  const { data, isLoading } = useCustomerDashboard(!preview);
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const rewardPoints = data?.reward_points ?? 0;
  const formattedPoints = rewardPoints.toLocaleString('en-IN');
  const activity = data?.activity ?? [];
  const navigate=useNavigate();
  const [howToUseOpen, setHowToUseOpen] = useState(false);
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
  useEffect(() => {
    AOS.init({ duration: 520, easing: 'ease-out-cubic', once: true, offset: 24, disable: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches });
    AOS.refresh();
  }, []);
  const [merchantSearch, setMerchantSearch] = useState('');
  const merchantDirectory = useInfiniteQuery({
    queryKey: ['product-list-merchants', user.id, merchantSearch],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => apiFetch<{ merchants: { id: string; merchant_name: string }[]; pagination: { page: number; totalPages: number } }>(`/api/customer/merchants?${new URLSearchParams({ page: String(pageParam), pageSize: '20', search: merchantSearch })}`, { signal }),
    getNextPageParam: last => last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    enabled: productListOpen && !preview,
  });
  const { data: offersData, isLoading: offersQueryLoading } = useCustomerOffers(loadSecondaryContent && !preview, customerLocation.data);
  const offersLoading = !loadSecondaryContent || offersQueryLoading;
  const offers = useMemo(()=>(offersOverride||offersData?.offers || []), [offersData,offersOverride]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const bestTrack=useRef<HTMLDivElement>(null);
  const [bestIndex,setBestIndex]=useState(0);
  const curated=!!layout?.sections?.length;
  const bestOffers=curated?curatedOffers(offers,sections.find(row=>row.id==='best')).slice(0,5):offers.slice(0,5);
  const trendingOffers=curated?curatedOffers(offers,sections.find(row=>row.id==='trending')):offers.filter(row=>row.is_trending);
  const categoryNames=[...new Set(offers.map(offer=>offerCategory(offer.category)))].sort((a,b)=>{const rank=(name:string)=>{const index=OFFER_CATEGORIES.indexOf(name);return index<0?OFFER_CATEGORIES.length:index;};return rank(a)-rank(b);});
  const categoryChoices=[{id:'all',label:'All Deals',icon:<Flame/>},...categoryNames.map(name=>({id:name,label:name,icon:<ShoppingBag/>}))];
  const bestPauseUntil=useRef(0);
  useEffect(()=>{
    if(bestOffers.length<2)return;
    let reset:ReturnType<typeof setTimeout>|undefined;
    const timer=setInterval(()=>{
      const track=bestTrack.current;
      if(!track||document.hidden||Date.now()<bestPauseUntil.current||track.matches(':hover, :focus-within')||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      const width=track.children[1]?(track.children[1] as HTMLElement).offsetLeft-(track.children[0] as HTMLElement).offsetLeft:track.clientWidth;
      const next=Math.round(track.scrollLeft/width)+1;
      track.scrollTo({left:next*width,behavior:'smooth'});
      if(next>=bestOffers.length)reset=setTimeout(()=>track.scrollTo({left:0,behavior:'instant'}),900);
    },2200);
    return()=>{clearInterval(timer);clearTimeout(reset);};
  },[bestOffers.length]);

  const {favorites,toggleFavorite}=useMerchantFavorites(user.id);
  useEffect(()=>{importLegacyOfferFavorites(user.id,offersData?.offers||[]);},[user.id,offersData]);
  const favoriteOffers=offers.filter(offer=>offer.merchant_id&&favorites.includes(offer.merchant_id));
  const filteredOffers = useMemo(() => {
    if (selectedCategory === 'all') return offers;
    return offers.filter(o=>offerCategory(o.category)===selectedCategory);
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

  const getOfferDiscountTag = (_idx = 0): string => 'Offer';

  const merchants = merchantDirectory.data?.pages.flatMap(page => page.merchants) || [];
  const location = useLocation();
  useEffect(() => { if (new URLSearchParams(location.search).get('productList') === '1') { setProductRequestId(new URLSearchParams(location.search).get('requestId') || ''); setProductListOpen(true); window.history.replaceState({}, '', '/customer/home'); } }, [location.search]);
  const submitProductList = useMutation({ mutationFn: async () => { const form = new FormData(); form.append('merchant_id', merchantId); if (productList.trim()) form.append('product_list', productList.trim()); if (pickupTime.trim()) form.append('pickup_time', pickupTime.trim()); if (productImage) form.append('image', productImage); return apiFetch('/api/customer/product-list-requests', { method: 'POST', body: form }); }, onSuccess: () => { setProductListMessage('Your product list was sent to the selected merchant.'); setProductList(''); setPickupTime(''); setProductImage(null); setMerchantId(''); void queryClient.invalidateQueries({ queryKey: ['customer-product-lists'] }); } });
  const { data: productHistory, isPending: historyLoading, isError: historyError, refetch: retryHistory } = useQuery({ queryKey: ['customer-product-lists', user.id], queryFn: () => apiFetch<{ requests: Array<{ id: string; product_list?: string; image_url?: string; status: string; created_at: string; pickup_time?: string; merchants?: { name?: string } }> }>('/api/customer/product-list-requests'), enabled: productListOpen, refetchInterval: productListOpen ? 15000 : false });

  const heroPointsRef = useRef<HTMLDivElement>(null);
  const [showStickyPoints, setShowStickyPoints] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  // Monitor when the top Hero Points Card scrolls out of view so the floating bottom pill smoothly appears
  useEffect(() => {
    const scrollWindow=heroPointsRef.current?.ownerDocument.defaultView||window;
    const handleScroll = () => {
      if (!heroPointsRef.current) {
        setShowStickyPoints(scrollWindow.scrollY > 200);
        return;
      }
      const rect = heroPointsRef.current.getBoundingClientRect();
      // When the bottom of the hero points card scrolls past the header (~75px)
      setShowStickyPoints(rect.bottom < 75);
    };

    scrollWindow.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollWindow.removeEventListener('scroll', handleScroll);
  }, []);

  // Give the customer the full viewport while actively scrolling, then restore
  // the navigation and compact points bar shortly after the finger is released.
  useEffect(() => {
    const scrollWindow=heroPointsRef.current?.ownerDocument.defaultView||window;
    let timer = 0;
    const onScroll = () => {
      setIsScrolling(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIsScrolling(false), 220);
    };
    scrollWindow.addEventListener('scroll', onScroll, { passive: true });
    return () => { scrollWindow.removeEventListener('scroll', onScroll); window.clearTimeout(timer); };
  }, []);


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
    <div className={`customer-modern-page ae-reference-home bg-white min-h-screen text-gray-900 font-sans pb-[180px] ${isScrolling ? 'ae-is-scrolling' : ''}`}>
      {/* Header */}
      <div className={`ae-immersive-hero ${heroImage ? 'ae-has-offer-backdrop' : ''} ${showStickyPoints ? 'ae-hero-passed' : ''}`}>
      <div className="ae-fixed-hero-background" aria-hidden="true" style={heroImage?{backgroundImage:`linear-gradient(180deg,rgba(5,28,71,.84),rgba(8,31,67,.12) 45%,rgba(10,26,62,.6) 82%,#f2efff),url(${JSON.stringify(heroImage)})`}:undefined}/>
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
              <strong className="underline underline-offset-2" style={{fontWeight:800}}>{i18n.language.startsWith('ml') ? 'AE എങ്ങനെ ഉപയോഗിക്കാം?' : 'How to use AE?'}</strong>
              <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
          <div className="ae-home-language shrink-0">
            <LanguageSelect/>
          </div>
        </div>

        <div className="ae-hero-banner" style={layout?.carouselHeight?{'--ae-carousel-height':`${layout.carouselHeight}px`} as CSSProperties:undefined}><HomeBanners onImageChange={setHeroImage} bannerIds={carouselFor(layout,carouselPlatform||(Capacitor.isNativePlatform()?'app':'web'))}/></div>

        {/* 3. Hero Points Section (Radiant Blue Theme, Compact) */}
        <section className="ae-hero-points" ref={heroPointsRef}>
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0c2e68] via-[#081f48] to-[#040f26] text-white p-2.5 shadow-xl shadow-blue-950/20 border border-blue-500/40 space-y-2">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-cyan-400/20 blur-xl pointer-events-none"></div>

            {/* Top Row: Label & Small Points Number + History Link */}
            <div className="ae-home-points-heading relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-1.5" role="link" tabIndex={0} aria-label={uiText('Points History')} style={{cursor:'pointer'}} onClick={()=>navigate('/customer/transactions')} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate('/customer/transactions');}}}>
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
                onClick={() => navigate('/customer/shop-scan?mode=earn')}
                className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 active:scale-[0.98] text-white font-bold text-xs py-2 px-2.5 rounded-xl transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 group"
              >
                <QrCode size={15} className="group-hover:scale-110 transition-transform text-white shrink-0" />
                <div className="text-left leading-tight">
                  <span className="block font-black text-[11px]">{homeText('pointsLabel','Claim Points')}</span>
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

        {/* 4. Nearby Best Offers (Top-Rated Partner Deals Near Chittur with Photos) */}
        </div></div><div className="ae-discovery-feed px-4 pt-1 space-y-3.5">
        <section style={sectionStyle('best')} className="ae-discovery-section ae-best-section space-y-2.5 pt-1" data-aos="fade-down" data-aos-delay="120">
          <div className="ae-home-section-heading flex items-end justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>⭐</span>
                <span>{homeText('bestOffersTitle','Best Offers')}</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {uiText("Top discounts and offers close to you")}
              </p>
            </div>
            <Link to="/customer/explore" className="text-xs font-bold text-blue-600 hover:underline">
              {uiText("Explore →")}
            </Link>
          </div>

          <div className="ae-best-offer-carousel" ref={bestTrack} onPointerDown={()=>{bestPauseUntil.current=Date.now()+8000;}} onScroll={()=>{const track=bestTrack.current;if(!track||!track.firstElementChild)return;const first=(track.firstElementChild as HTMLElement).offsetLeft;let nearest=0,distance=Infinity;Array.from(track.children).forEach((item,index)=>{const delta=Math.abs((item as HTMLElement).offsetLeft-first-track.scrollLeft);if(delta<distance){nearest=index;distance=delta;}});setBestIndex(nearest%Math.max(1,bestOffers.length));}}>
            {(bestOffers.length>1?[...bestOffers,bestOffers[0]]:bestOffers).map((offer, idx) => {
              const photo = getOfferPhoto(offer, idx);
              const tag = getOfferDiscountTag(idx);
              return (
                <div
                  key={`best-offer-${offer.id}-${idx}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.currentTarget.click();}}}
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
                  className="ae-discovery-card ae-best-card group relative rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="ae-discovery-photo relative h-[95px] overflow-hidden bg-slate-100">
                    <img src={photo} alt={offer.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />{offer.merchant_id&&<button type="button" className="absolute top-2 right-2 z-10 rounded-full bg-white p-2 text-rose-600" aria-pressed={favorites.includes(offer.merchant_id)} aria-label={uiText(favorites.includes(offer.merchant_id)?'Remove favorite':'Add favorite')} onClick={event=>{event.stopPropagation();toggleFavorite(offer.merchant_id);}}><Heart size={16} fill={favorites.includes(offer.merchant_id)?'currentColor':'none'}/></button>}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"></div>
                    <span className="absolute top-2 left-2 bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-xs">
                      {uiText(tag)}
                    </span>
                    <span className="absolute bottom-1.5 left-2 text-[10px] text-cyan-300 font-bold">{uiText(" 📍 Nearby ")}</span>
                  </div>
                  <div className="ae-discovery-copy p-2.5 space-y-1">
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
          {bestOffers.length>1&&<div className="ae-best-loop-line" role="status" aria-label={`${uiText('Offer')} ${bestIndex+1} / ${bestOffers.length}`}><span style={{left:`${bestIndex*100/bestOffers.length}%`,width:`${100/bestOffers.length}%`}}/></div>}
        </section>

        <section style={sectionStyle('image')} className="ae-discovery-section ae-admin-image-grid" aria-label="Featured images">{sections.find(row=>row.id==='image')?.images?.map(image=><img key={image.id} src={image.url} alt={image.alt} loading="lazy"/>)}</section>
        {/* 7. Trending Offers Carousel */}
        <section style={sectionStyle('trending')} className="ae-discovery-section ae-trending-section space-y-2.5 pt-1" data-aos="fade-down" data-aos-delay="240">
          <div className="ae-home-section-heading flex items-end justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>⚡</span>
                <span>{homeText('trendingTitle','Trending Offers')}</span>
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
          <div className="ae-nearby-offer-rail">
            {trendingOffers.map((offer, idx) => {
              const photo = getOfferPhoto(offer, idx + 3);
              const tag = getOfferDiscountTag(idx + 2);
              return (
                <div
                  key={`slide-${offer.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.currentTarget.click();}}}
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
                  className="ae-discovery-card ae-trending-card group w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="ae-discovery-photo relative h-[105px] overflow-hidden bg-slate-100">
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
                      <span className="text-gray-500 truncate max-w-[110px]">{offer.merchant_address || uiText("Nearby")}</span>
                      <span className="text-blue-600 font-bold">{uiText("View →")}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. Nearby Partner Offers & Shops (Real Store Photos) */}
        <section style={sectionStyle('nearby')} className="ae-discovery-section ae-nearby-section space-y-2.5 pt-1" data-aos="fade-down" data-aos-delay="160">
          <div className="ae-home-section-heading flex items-end justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>📍</span>
                <span>{uiText("Nearby Shops & Offers")}</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {uiText("Discover offers from shops around you")}
              </p>
            </div>
            <Link to="/customer/explore" className="text-xs font-bold text-blue-600 hover:underline">
              {uiText("View Map →")}
            </Link>
          </div>

          <div className="ae-nearby-offer-rail">
            {nearbyOffers.map((offer, idx) => {
              const photo = getOfferPhoto(offer, idx + 2);
              const tag = getOfferDiscountTag(idx + 1);
              return (
                <div
                  key={`nearby-${offer.id}-${idx}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.currentTarget.click();}}}
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
                  className="ae-discovery-card ae-nearby-card group w-[200px] shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="ae-discovery-photo relative h-[95px] overflow-hidden bg-slate-100">
                    <img src={photo} alt={offer.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"></div>
                    <span className="absolute top-2 left-2 bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-xs">
                      {uiText(tag)}
                    </span>
                    <span className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-cyan-300 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                      📍 {typeof offer.distance === 'number' ? `${offer.distance.toFixed(1)} km` : uiText("Nearby")}
                    </span>
                    <div className="absolute bottom-1.5 left-2 right-2">
                      <h4 className="font-bold text-xs text-white leading-tight line-clamp-1">{offer.merchant_name || uiText("AE Partner Store")}</h4>
                    </div>
                  </div>
                  <div className="ae-nearby-card-footer">
                    <div className="ae-nearby-copy"><h4>{offer.merchant_name || uiText("AE Partner Store")}</h4><p>{offer.title}</p><span><MapPin size={12}/>{offer.merchant_address || uiText("Location unavailable")}</span>{offer.merchant_code&&<small>{offer.merchant_code}</small>}</div>
                    <span className="text-blue-600 font-bold">{uiText("View →")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 6. Category-Wise Offers */}
        <section style={sectionStyle('categories')} className="ae-discovery-section ae-category-section space-y-3 pt-1" data-aos="fade-down" data-aos-delay="200">
          <div className="ae-home-section-heading flex items-end justify-between">
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
          <div className="ae-category-filter">
            {categoryChoices.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                aria-pressed={selectedCategory === cat.id}
                className={`ae-category-choice flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-xs scale-[1.02]'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
              >
                <span>{categoryArtwork[cat.id]?<img src={categoryArtwork[cat.id]} alt="" loading="lazy" width={36} height={36}/>:cat.icon}</span>
                <span>{uiText(cat.label)}</span>
              </button>
            ))}
          </div>

          <div aria-live="polite" aria-label={uiText(categoryChoices.find(row=>row.id===selectedCategory)?.label||'Category Offers')}>
          {offersLoading ? (
            <div className="rounded-2xl bg-gray-50 py-10 text-center text-sm text-gray-400 font-medium">
              {uiText("Loading exciting partner offers...")}
            </div>
          ) : filteredOffers.length ? (
            <div className="ae-category-offer-rail">
              {filteredOffers.map((offer, idx) => {
                const photo = getOfferPhoto(offer, idx);
                const tag = getOfferDiscountTag(idx);
                return (
                  <div
                    key={offer.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {setSelectedOffer({
                      id: offer.id,
                      title: offer.title,
                      description: offer.description,
                      imageUrl: photo,
                      merchantName: offer.merchant_raw_name || offer.merchant_name,
                      merchantPhone: offer.merchant_phone,
                      merchantAddress: offer.merchant_address,
                      category: offer.category,
                      expiresAt: offer.expires_at,
                    });}}
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
                    className="ae-discovery-card ae-category-card group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
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
          </div>
        </section>

        {/* 8. Favourite Offers (At the very end) */}
        <section style={sectionStyle('favourites')} className="ae-discovery-section ae-favourite-section space-y-2.5 pt-1" data-aos="fade-down" data-aos-delay="280">
          <div className="ae-home-section-heading flex items-end justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span className="text-rose-500">❤️</span>
                <span>{uiText("Favourite Shops Offers")}</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {uiText('Offers from your saved shops')}
              </p>
            </div>
            <Link to="/customer/offers" className="text-xs font-bold text-blue-600 hover:underline">
              {uiText("Browse more →")}
            </Link>
          </div>

          {!favoriteOffers.length&&<p className="text-sm text-slate-500">{uiText('Save a shop using the heart in Offers or Explore. Its offers will appear here.')}</p>}
          <div className="ae-favourite-feed">
            {favoriteOffers.map((offer, idx) => {
              const photo = getOfferPhoto(offer, idx + 1);
              const tag = getOfferDiscountTag(idx);
              const isFav = !!offer.merchant_id&&favorites.includes(offer.merchant_id);
              return (
                <div
                  key={`fav-${offer.id}-${idx}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.currentTarget.click();}}}
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
                  className="ae-discovery-card ae-favourite-card group relative overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative h-[95px] overflow-hidden bg-rose-50">
                    <img src={photo} alt={offer.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>
                    <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      {uiText(tag)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {e.stopPropagation();toggleFavorite(offer.merchant_id);}}
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-xs transition-transform active:scale-90 ${isFav ? 'bg-white text-rose-500' : 'bg-black/30 text-white hover:bg-black/50'
                        }`}
                      aria-pressed={isFav} aria-label={uiText(isFav?'Remove favorite':'Add favorite')}
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
        className={`ae-home-floating-points fixed bottom-[calc(84px+env(safe-area-inset-bottom,16px))] md:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-[420px] z-40 transition-all duration-300 transform ${showStickyPoints && !isScrolling ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
      >
        <div className="ae-points-capsule">
          <Link to="/customer/transactions" className="ae-capsule-balance" aria-label={`${uiText('Available Points:')} ${formattedPoints}. ${uiText('Points History')}`}>
            <span className="ae-capsule-coin" aria-hidden="true">✦</span>
            <span className="ae-capsule-total"><small>{uiText('Available Points:')}</small><strong>{isLoading?'…':formattedPoints}<em>{uiText('PTS')}</em></strong></span>
          </Link>
          <div className="ae-capsule-actions">
            <button type="button" onClick={()=>navigate('/customer/shop-scan?mode=earn')} title={uiText('Claim Points on purchase')}><QrCode size={14}/><span>{uiText('Claim')}</span></button>
            <Link to="/customer/shop-scan?mode=redeem" title={uiText('Redeem Points')}><Gift size={14}/><span>{i18n.language.startsWith('ml')?'ഉപയോഗിക്കുക':uiText('Redeem')}</span></Link>
          </div>
        </div>
      </aside>
      {/* END: StickyFloatingPointsBar */}



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
                    {i18n.language.startsWith('ml') ? 'AE എങ്ങനെ ഉപയോഗിക്കാം?' : 'How to use AE?'}
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
                    {uiText("Redeem points for discounts or send product grocery lists directly to shops via WhatsApp!")}
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
                  navigate('/customer/shop-scan?mode=earn');
                }}
                className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <QrCode size={15} />
                <span>{uiText("Scan Merchant Shop QR")}</span>
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
