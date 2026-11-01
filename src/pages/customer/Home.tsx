import { uiText } from '../../uiText';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import QRCode from 'qrcode';
import { Bell, ChevronRight, Gift, Languages, Star, ListPlus, ShoppingBag, QrCode, Tags, User } from 'lucide-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../../types';
import { useCustomerDashboard, useCustomerOffers } from '../../hooks/useCustomerData';
import { useCustomerLocation } from '../../hooks/useCustomerLocation';
import { apiFetch } from '../../api';
import { useDailyGreeting } from '../../dailyGreeting';
import { CustomerLocationBar } from '../../components/CustomerLocationBar';
import { CustomerAds } from '../../components/CustomerAds';
import { CustomerPromoBanners } from '../../components/CustomerPromoBanners';
import { CustomerOfferPreviewModal, type PreviewOfferData } from '../../components/CustomerOfferPreviewModal';
import './home-reference.css';
import { ProductListPanel } from '../../components/ProductListPanel';

export function CustomerHome({ user }: { user: UserProfile }) {
  const customerLocation = useCustomerLocation(true, true);
  const dailyGreeting = useDailyGreeting('customer');
  const { data, isLoading } = useCustomerDashboard();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const rewardPoints = data?.reward_points ?? 0;
  const formattedPoints = rewardPoints.toLocaleString('en-IN');
  const [selectedOffer, setSelectedOffer] = useState<PreviewOfferData | null>(null);
  const [productListOpen, setProductListOpen] = useState(false);
  const [productRequestId, setProductRequestId] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [productList, setProductList] = useState('');
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
  const merchants = merchantDirectory.data?.pages.flatMap(page => page.merchants) || [];
  const location = useLocation();

  useEffect(() => {
    if (new URLSearchParams(location.search).get('productList') === '1') {
      setProductRequestId(new URLSearchParams(location.search).get('requestId') || '');
      setProductListOpen(true);
      window.history.replaceState({}, '', '/customer/home');
    }
  }, [location.search]);

  const submitProductList = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('merchant_id', merchantId);
      if (productList.trim()) form.append('product_list', productList.trim());
      if (productImage) form.append('image', productImage);
      return apiFetch('/api/customer/product-list-requests', { method: 'POST', body: form });
    },
    onSuccess: () => {
      setProductListMessage('Your product list was sent to the selected merchant.');
      setProductList('');
      setProductImage(null);
      setMerchantId('');
      void queryClient.invalidateQueries({ queryKey: ['customer-product-lists'] });
    }
  });

  const { data: productHistory, isPending: historyLoading, isError: historyError, refetch: retryHistory } = useQuery({
    queryKey: ['customer-product-lists', user.id],
    queryFn: () => apiFetch<{ requests: Array<{ id: string; product_list?: string; image_url?: string; status: string; created_at: string; merchants?: { name?: string } }> }>('/api/customer/product-list-requests'),
    enabled: productListOpen,
    refetchInterval: productListOpen ? 15000 : false
  });

  return (
    <div className="customer-modern-page ae-reference-home bg-white min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="customer-modern-topbar flex justify-between items-center px-4 py-3 bg-white sticky top-0 z-10 border-b border-gray-100">
        <img src="/logo.png" alt={uiText("AE")} className="customer-home-logo object-contain" style={{ width: 72, height: 42 }} />
        <CustomerLocationBar compact />
        <Link to="/customer/profile" aria-label="Profile" className="text-gray-700 hover:text-gray-900"><User size={22}/></Link>
        <Link to="/customer/notifications" className="relative text-gray-700 hover:text-gray-900" aria-label="Notifications">
          <Bell size={22} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </Link>
      </header>

      <div className="px-4 pt-1 space-y-4">
        {/* Greeting & Language Toggle */}
        <div className="customer-modern-greeting flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0">
            <h2 className="text-[19px] font-bold text-gray-900 mb-0.5 flex items-center gap-1">
              {uiText(" Hi, ")}{user.name?.split(' ')[0] || user.phone || 'User'}! <span className="text-[18px]">👋</span>
            </h2>
            <p className="text-[12px] text-gray-500 font-medium tracking-wide">{uiText(dailyGreeting)}</p>
          </div>
          <div className="ae-home-language">
            <label className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-600 shadow-sm" title={t('language.malayalam')}>
              <Languages size={15} />
              <select
                className="w-9 border-0 bg-transparent p-0 text-[11px] font-bold outline-none"
                value={i18n.language.startsWith('ml') ? 'ml' : 'en'}
                onChange={(event) => void i18n.changeLanguage(event.target.value)}
                aria-label={t('language.malayalam')}
              >
                <option value="en">{uiText("EN")}</option>
                <option value="ml">മ</option>
              </select>
            </label>
          </div>
        </div>

        {/* Compact & Clean Points Card */}
        <Link
          to="/customer/transactions"
          className="customer-home-points customer-modern-points-card flex items-center justify-between rounded-xl px-4 py-3 text-white shadow-sm relative overflow-hidden active:scale-[0.98] transition-transform w-full bg-gradient-to-r from-[#059669] via-[#0d9488] to-[#0284c7]"
        >
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <Star className="text-white fill-white" size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wider block leading-none mb-1">
                {uiText("Your AE Points")}
              </span>
              <span className="text-[22px] font-extrabold tracking-tight leading-none text-white block">
                {isLoading ? '...' : formattedPoints}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg backdrop-blur-sm shrink-0 transition-colors">
            <span className="text-[11px] font-semibold text-white">{uiText("History")}</span>
            <ChevronRight size={14} className="text-white" />
          </div>
        </Link>

        {/* Main Advertisements Hero Carousel */}
        <CustomerAds location={customerLocation.data} />

        {/* Compact Quick Action Shortcuts */}
        <nav className="ae-home-shortcuts" aria-label={uiText("Customer quick actions")}>
          <Link to="/customer/shop-scan?mode=claim" className="qr">
            <QrCode size={20} />
            <span>{uiText("Claim Points")}</span>
          </Link>
          <Link to="/customer/shop-scan?mode=redeem" className="redeem">
            <Gift size={20} />
            <span>{uiText("Redeem Points")}</span>
          </Link>
          <Link to="/customer/explore" className="shops">
            <ShoppingBag size={20} />
            <span>{uiText("Nearby Shops")}</span>
          </Link>
          <Link to="/customer/offers" className="offers">
            <Tags size={20} />
            <span>{uiText("Offers")}</span>
          </Link>
        </nav>

        {/* Featured Offers Grid */}
        <section className="pt-1">
          <div className="mb-2.5 flex items-end justify-between">
            <div>
              <h3 className="text-[15px] font-bold text-gray-900">{uiText("Featured Offers Near You")}</h3>
              <p className="text-[11px] text-gray-500">{uiText("Save more at AE businesses near you")}</p>
            </div>
            <Link to="/customer/offers" className="text-[12px] font-bold text-[#087a4b] hover:underline">{uiText("View all")}</Link>
          </div>
          {offersLoading ? (
            <div className="rounded-xl bg-gray-50 py-8 text-center text-sm text-gray-400">{uiText("Loading offers...")}</div>
          ) : offers.length ? (
            <div className="grid grid-cols-2 gap-3">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOffer({
                    id: offer.id,
                    title: offer.title,
                    description: offer.description,
                    imageUrl: offer.imageUrl,
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
                        imageUrl: offer.imageUrl,
                        merchantName: offer.merchant_raw_name || offer.merchant_name,
                        merchantPhone: offer.merchant_phone,
                        merchantAddress: offer.merchant_address,
                        category: offer.category,
                        expiresAt: offer.expires_at,
                      });
                    }
                  }}
                  className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer hover:border-blue-200"
                >
                  <div className="h-[105px] bg-gradient-to-br from-[#e6f8ef] to-[#eef4ff]">
                    {offer.imageUrl ? (
                      <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#087a4b]"><Gift size={30} /></div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <h4 className="line-clamp-2 text-[12px] font-bold leading-tight text-gray-900">{offer.title}</h4>
                    <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[#e11d48]">{offer.description}</p>
                    <p className="mt-1.5 line-clamp-1 text-[10px] text-gray-500">{offer.merchant_name || 'AE Merchant'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 px-4 py-7 text-center text-sm text-gray-400">{uiText("No active offers right now.")}</div>
          )}
        </section>

        {/* Extra Promotional Banners Section */}
        <CustomerPromoBanners location={customerLocation.data} />

        {/* Send Product List Button */}
        <button
          type="button"
          onClick={() => { setProductListOpen(true); setProductListMessage(''); }}
          className="flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-left text-blue-700 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <ListPlus size={24} />
            <div>
              <span className="block text-[15px] font-bold">{uiText("Send Product List")}</span>
              <span className="block text-[11px] text-blue-600/80">{uiText("Send grocery or shopping list to local store")}</span>
            </div>
          </div>
          <ChevronRight size={18} />
        </button>
      </div>

      <CustomerOfferPreviewModal offer={selectedOffer} onClose={() => setSelectedOffer(null)} />

      {productListOpen && (
        <ProductListPanel
          requestId={productRequestId}
          name={user.full_name || uiText('Customer')}
          requests={productHistory?.requests || []}
          loading={historyLoading}
          historyError={historyError}
          retry={() => void retryHistory()}
          merchants={merchants}
          searchMerchants={setMerchantSearch}
          merchantsLoading={merchantDirectory.isFetching}
          merchantsError={merchantDirectory.isError}
          hasMoreMerchants={merchantDirectory.hasNextPage}
          loadMoreMerchants={() => void merchantDirectory.fetchNextPage()}
          retryMerchants={() => void merchantDirectory.refetch()}
          merchantId={merchantId}
          setMerchantId={setMerchantId}
          value={productList}
          setValue={setProductList}
          image={productImage}
          setImage={setProductImage}
          message={productListMessage}
          error={submitProductList.error ? (submitProductList.error as Error).message : ''}
          pending={submitProductList.isPending}
          send={() => submitProductList.mutate()}
          close={() => setProductListOpen(false)}
        />
      )}
    </div>
  );
}
