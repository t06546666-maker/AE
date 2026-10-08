import { formatDateTime } from '../../utils';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import QRCode from 'qrcode';
import { Bell, ChevronRight, Gift, Languages, MapPin, Star, ListPlus, X, Upload, ShoppingBag, QrCode, Tags } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../../types';
import { useCustomerDashboard, useCustomerMerchants, useCustomerOffers } from '../../hooks/useCustomerData';
import { apiFetch } from '../../api';
import { CustomerPaymentRequests } from '../../components/CustomerPaymentRequests';
import { useDailyGreeting } from '../../dailyGreeting';
import { CustomerLocationBar } from '../../components/CustomerLocationBar';
import { CustomerAds } from '../../components/CustomerAds';
import './home-reference.css';

export function CustomerHome({ user }: { user: UserProfile }) {
  const dailyGreeting = useDailyGreeting('customer');
  const { data, isLoading } = useCustomerDashboard();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const rewardPoints = data?.reward_points ?? 0;
  const formattedPoints = rewardPoints.toLocaleString('en-IN');
  const activity = data?.activity ?? [];
  const [qrSrc, setQrSrc] = useState('');
  const [productListOpen, setProductListOpen] = useState(false);
  const [merchantId, setMerchantId] = useState('');
  const [productList, setProductList] = useState('');
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productListMessage, setProductListMessage] = useState('');
  const [expandedProductList, setExpandedProductList] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState('');
  const { data: merchantData } = useCustomerMerchants(1);
  const { data: offersData, isLoading: offersLoading } = useCustomerOffers();
  const offers = (offersData?.offers || []).slice(0, 6);
  const merchants = merchantData?.merchants || [];
  const location = useLocation();
  useEffect(() => { if (new URLSearchParams(location.search).get('productList') === '1') { setProductListOpen(true); window.history.replaceState({}, '', '/customer/home'); } }, [location.search]);
  const submitProductList = useMutation({ mutationFn: async () => { const form = new FormData(); form.append('merchant_id', merchantId); if (productList.trim()) form.append('product_list', productList.trim()); if (productImage) form.append('image', productImage); return apiFetch('/api/customer/product-list-requests', { method: 'POST', body: form }); }, onSuccess: () => { setProductListMessage('Your product list was sent to the selected merchant.'); setProductList(''); setProductImage(null); setMerchantId(''); void queryClient.invalidateQueries({ queryKey: ['customer-product-lists'] }); } });
  const { data: productHistory } = useQuery({ queryKey: ['customer-product-lists'], queryFn: () => apiFetch<{ requests: Array<{ id: string; product_list?: string; image_url?: string; status: string; created_at: string; merchants?: { name?: string } }> }>('/api/customer/product-list-requests'), enabled: productListOpen });

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
    <div className="customer-modern-page ae-reference-home bg-white min-h-screen text-gray-900 font-sans pb-[100px]">
      <CustomerPaymentRequests />
      {/* Header */}
      <header className="customer-modern-topbar flex justify-between items-center px-4 py-4 bg-white sticky top-0 z-10">
        <img src="/logo.png" alt="AE" className="customer-home-logo object-contain" style={{ width: 83, height: 48 }} />
        <CustomerLocationBar compact />
        <Link to="/customer/notifications" className="relative text-gray-800">
          <Bell size={24} />
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-[1.5px] border-white"></span>
        </Link>
      </header>

      <div className="px-4 pt-2 space-y-6">
        <CustomerAds />
        {/* Greeting */}
        <div className="customer-modern-greeting">
          <h2 className="text-[20px] font-bold text-gray-900 mb-0.5 flex items-center gap-1">
            Hi, {user.name?.split(' ')[0] || user.phone || 'User'}! <span className="text-[20px]">👋</span>
          </h2>
          <p className="text-[13px] text-gray-500 font-medium tracking-wide">{dailyGreeting}</p>
        </div>

        {/* Points Card */}
        <Link to="/customer/transactions" className="customer-home-points customer-modern-points-card block rounded-[16px] p-5 text-white shadow-md relative overflow-hidden active:scale-[0.98] transition-transform w-full">
          <div className="flex justify-between items-center relative z-10">
            <div>
              <p className="text-[13px] font-medium text-green-50 mb-1">Your AE Points</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#f59e0b] rounded-full flex items-center justify-center shadow-inner">
                  <Star className="text-white fill-white" size={16} />
                </div>
                <span className="text-[36px] font-bold tracking-tight">{isLoading ? '...' : formattedPoints}</span>
              </div>
              <p className="mt-1 text-[11px] text-green-50/80">Live balance from your account</p>
            </div>
            <ChevronRight size={20} className="text-white" />
          </div>
        </Link>

        <nav className="ae-home-shortcuts" aria-label="Customer quick actions">
          <Link to="/customer/explore" className="shops"><ShoppingBag/><span>Nearby Shops</span></Link>
          <Link to="/customer/offers" className="offers"><Tags/><span>Offers</span></Link>
          <Link to="/customer/scan" className="qr"><QrCode/><span>My QR Code</span></Link>
          <Link to="/customer/rewards" className="redeem"><Gift/><span>Redeem Points</span></Link>
        </nav>
        <CustomerAds />
        {/* Merchant offers grid */}
        <section className="pt-1">
          <div className="mb-3 flex items-end justify-between">
            <div><h3 className="text-[16px] font-bold text-gray-900">Featured Offers Near You</h3><p className="text-[11px] text-gray-500">Save more at AE businesses near you</p></div>
            <Link to="/customer/offers" className="text-[12px] font-bold text-[#087a4b]">View all</Link>
          </div>
          {offersLoading ? <div className="rounded-2xl bg-gray-50 py-8 text-center text-sm text-gray-400">Loading offers...</div> : offers.length ? <div className="grid grid-cols-2 gap-3">{offers.map((offer) => <Link to="/customer/offers" key={offer.id} className="overflow-hidden rounded-[18px] border border-gray-100 bg-white shadow-sm active:scale-[0.98] transition-transform"><div className="h-[112px] bg-gradient-to-br from-[#e6f8ef] to-[#eef4ff]">{offer.imageUrl ? <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#087a4b]"><Gift size={34} /></div>}</div><div className="p-3"><h4 className="line-clamp-2 text-[13px] font-bold leading-tight text-gray-900">{offer.title}</h4><p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[#e11d48]">{offer.description}</p><p className="mt-2 line-clamp-1 text-[10px] text-gray-500">{offer.merchant_name || 'AE Merchant'}</p></div></Link>)}</div> : <div className="rounded-2xl bg-gray-50 px-4 py-7 text-center text-sm text-gray-400">No active offers right now.</div>}
        </section>
        <button type="button" onClick={() => { setProductListOpen(true); setProductListMessage(''); }} className="flex w-full items-center justify-between rounded-[18px] border border-blue-100 bg-blue-50 p-4 text-left text-blue-700 shadow-sm active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3"><ListPlus size={28} /><div><span className="block text-[16px] font-bold">Send Product List</span></div></div><ChevronRight size={20} />
        </button>


        {/* Recent Activity */}
        <div className="pt-2">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-[16px] font-bold text-gray-900 tracking-wide">Recent Activity</h3>
            <Link to="/customer/transactions" className="text-[12px] font-bold text-[#22c55e]">View All</Link>
          </div>
          <div className="space-y-0 divide-y divide-gray-100 border-t border-gray-100">
            {isLoading ? (
              <div className="py-8 text-center text-gray-400 text-sm">Loading activity...</div>
            ) : activity.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">No recent activity</div>
            ) : (
              activity.map((item, idx) => (
                <div key={item.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-[42px] h-[42px] ${getAvatarColor(idx)} text-white rounded-full flex items-center justify-center font-bold text-[10px] leading-tight text-center`}>
                      {getInitials(item.merchant_name)}
                    </div>
                    <div>
                      <p className="font-bold text-[14px] text-gray-900 leading-tight">{item.merchant_name || 'Store'}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {formatDateTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold text-[14px] ${item.type !== 'redeem' ? 'text-[#22c55e]' : 'text-gray-900'}`}>
                    {item.type !== 'redeem' ? '+' : '-'}{item.points}{item.type === 'bonus' ? ' bonus' : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="ae-home-language"><label className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-gray-600 shadow-sm" title={t('language.malayalam')}>
          <Languages size={16} />
          <select
            className="w-9 border-0 bg-transparent p-0 text-[10px] font-bold outline-none"
            value={i18n.language.startsWith('ml') ? 'ml' : 'en'}
            onChange={(event) => void i18n.changeLanguage(event.target.value)}
            aria-label={t('language.malayalam')}
          >
            <option value="en">EN</option>
            <option value="ml">മ</option>
          </select>
        </label></div>
        {/* Personal customer journey: counts come from all purchases, not recent activity. */}
        <section className="customer-modern-list-card rounded-[18px] p-4 shadow-sm" aria-labelledby="customer-journey-title">
          <h3 id="customer-journey-title" className="text-[16px] font-bold text-gray-900">Your Customer Journey</h3>
          <p className="mt-1 text-[12px] text-gray-600">Your purchases across AE merchants.</p>
          {isLoading ? <p className="py-4 text-sm text-gray-500">Loading your journey...</p> : data?.purchase_count == null ? <p className="py-4 text-sm text-gray-500">Your journey is currently unavailable.</p> : <>
            <p className="my-3 text-sm font-semibold text-gray-900">{data.purchase_count.toLocaleString('en-IN')} recorded purchases</p>
            <ol className="space-y-3">{[
              { title: 'First visit', threshold: 1, description: 'Make your first purchase at an AE merchant.' },
              { title: 'Repeat visit', threshold: 2, description: 'Complete two recorded purchases.' },
              { title: 'Loyal customer', threshold: 3, description: 'Complete three recorded purchases.' },
            ].map((stage, index) => <li key={stage.title} className="flex items-center gap-3 rounded-xl bg-white/70 p-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold ${data.purchase_count! >= stage.threshold ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{index + 1}</span><div className="flex-1"><strong className="text-sm text-gray-900">{stage.title}</strong><p className="text-xs text-gray-600">{stage.description}</p></div><span className="text-xs font-semibold text-gray-700">{data.purchase_count! >= stage.threshold ? 'Reached' : 'Not yet'}</span></li>)}</ol>
          </>}
        </section>

      </div>
      {productListOpen ? <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) setProductListOpen(false); }}><div className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Product Lists</h2><button type="button" onClick={() => setProductListOpen(false)}><X /></button></div>
        <div className="mb-5 rounded-2xl bg-gray-50 p-3"><h3 className="mb-2 text-sm font-bold text-gray-900">Sent to merchants</h3>{productHistory?.requests?.length ? <div className="space-y-2">{productHistory.requests.map(request => { const expanded = expandedProductList === request.id; const statusClass = ['accepted', 'approved'].includes(request.status) ? 'bg-green-100 text-green-700' : request.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'; return <button type="button" key={request.id} onClick={() => setExpandedProductList(expanded ? null : request.id)} className="w-full rounded-xl bg-white p-3 text-left text-xs shadow-sm"><div className="flex items-center justify-between gap-2"><span className="font-bold text-gray-900">{request.merchants?.name || 'Merchant'}</span><span className={`rounded-full px-2 py-1 font-semibold capitalize ${statusClass}`}>{request.status}</span></div><p className={`mt-1 text-gray-600 ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{request.product_list || 'Photo product list uploaded'}</p>{expanded && request.image_url ? <img src={request.image_url} alt="Submitted product list" onClick={(event) => { event.stopPropagation(); setPreviewImage(request.image_url || ''); }} className="mt-2 max-h-56 w-full cursor-zoom-in rounded-lg object-contain" /> : null}<p className="mt-1 font-medium text-gray-400">{new Date(request.created_at).toLocaleDateString()} · {expanded ? 'Collapse' : 'Tap to view full list'}</p></button>; })}</div> : <p className="text-xs text-gray-500">No product lists sent yet.</p>}</div>
        <h3 className="mb-2 text-sm font-bold text-gray-900">Send a new product list</h3>
        <p className="mb-3 text-xs text-gray-500">Choose a merchant and send a text list or photo directly to them.</p>
        <select value={merchantId} onChange={event => setMerchantId(event.target.value)} className="mb-3 w-full rounded-xl border border-gray-200 p-3 text-sm"><option value="">Select merchant</option>{merchants.map(merchant => <option key={merchant.id} value={merchant.id}>{merchant.merchant_name}</option>)}</select>
        <textarea value={productList} onChange={event => setProductList(event.target.value)} rows={4} maxLength={5000} placeholder="Type the products you need..." className="mb-3 w-full rounded-xl border border-gray-200 p-3 text-sm" />
        <label className="mb-4 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 p-3 text-sm text-gray-600"><Upload size={18} />{productImage ? productImage.name : 'Upload a product-list photo'}<input type="file" accept="image/*" className="hidden" onChange={event => setProductImage(event.target.files?.[0] || null)} /></label>
        {productListMessage ? <p className="mb-3 text-sm text-green-700">{productListMessage}</p> : null}
        {submitProductList.error ? <p className="mb-3 text-sm text-red-600">{(submitProductList.error as Error).message}</p> : null}
        <button type="button" disabled={!merchantId || (!productList.trim() && !productImage) || submitProductList.isPending} onClick={() => submitProductList.mutate()} className="w-full rounded-xl bg-[#087a4b] p-3 font-bold text-white disabled:opacity-50">{submitProductList.isPending ? 'Sending...' : 'Send Product List'}</button>
      </div></div> : null}
      {previewImage ? <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage('')}><button type="button" onClick={() => setPreviewImage('')} className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-gray-900"><X /></button><img src={previewImage} alt="Product list full preview" onClick={event => event.stopPropagation()} className="max-h-[90vh] max-w-full rounded-xl object-contain" /></div> : null}
    </div>
  );
}
