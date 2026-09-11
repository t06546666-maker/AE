import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserProfile } from '../../types';
import { useCustomerOffers, useCustomerRedeemReward } from '../../hooks/useCustomerData';

const CATEGORIES = ['All', 'Food & Beverage', 'Retail', 'Health'];

export function CustomerRewards({ user }: { user: UserProfile }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const { data, isLoading } = useCustomerOffers();
  const { mutate: redeem, isPending: redeeming } = useCustomerRedeemReward();

  const allRewards = data?.offers ?? [];

  const filtered = allRewards.filter(r => {
    const matchesSearch = !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || (r.merchant_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCategory === 'All' || true; // extend when API provides categories
    return matchesSearch && matchesCat;
  });

  const showToast = (text: string, ok: boolean) => {
    setToastMsg({ text, ok });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleRedeem = (offerId: string) => {
    setConfirmId(null);
    redeem(offerId, {
      onSuccess: (data) => showToast(`Redeemed! ${data.points_used ?? ''} points used.`, true),
      onError: (err: any) => showToast(err?.message || 'Redemption failed. Try again.', false),
    });
  };

  const confirmItem = allRewards.find(r => r.id === confirmId);

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/home"><ArrowLeft size={24} /></Link>
          <h1 className="text-lg font-bold">Rewards</h1>
        </div>
        <button onClick={() => { setSearchOpen(o => !o); setSearchQuery(''); }} className="text-gray-800">
          {searchOpen ? <X size={24} /> : <Search size={24} />}
        </button>
      </header>

      {/* Search Bar */}
      {searchOpen && (
        <div className="px-5 pt-3 pb-1 bg-white border-b border-gray-100">
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search rewards..."
            className="w-full bg-gray-50 border border-gray-200 rounded-[12px] px-4 py-2.5 text-[14px] font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#087a4b] focus:ring-1 focus:ring-[#087a4b] transition-all"
          />
        </div>
      )}

      {/* Categories */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide -mx-5 px-5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                activeCategory === cat
                  ? 'bg-[#087a4b] text-white shadow-md shadow-green-600/20'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-3 pt-2">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Loading rewards...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No available rewards right now.</div>
        ) : (
          filtered.map((reward) => (
            <div key={reward.id} className="bg-white rounded-[20px] p-3 flex gap-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
              <div className="w-[88px] h-[88px] bg-gray-50 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden">
                {reward.imageUrl ? (
                  <img src={reward.imageUrl} alt={reward.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                )}
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">{reward.title}</h3>
                <p className="text-[12px] text-gray-500 mt-1 mb-2">{reward.merchant_name || 'Store'}</p>
                <div className="flex justify-between items-center mt-auto">
                  <p className="text-[12px] font-bold text-[#087a4b] flex items-center gap-1">
                    <span className="w-4 h-4 bg-[#f59e0b] rounded-full flex items-center justify-center text-white text-[10px] leading-none">★</span>
                    Points Reward
                  </p>
                  <button
                    onClick={() => setConfirmId(reward.id)}
                    className="bg-[#087a4b] text-white px-4 py-1.5 rounded-full text-[11px] font-bold hover:bg-[#0a7a46] transition-colors shadow-sm disabled:opacity-50"
                  >
                    Redeem
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirm Redeem Modal */}
      {confirmItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setConfirmId(null)}>
          <div className="bg-white rounded-t-[32px] w-full max-w-[430px] p-6 pb-10" onClick={e => e.stopPropagation()}>
            <h2 className="text-[18px] font-bold text-gray-900 mb-1">Confirm Redemption</h2>
            <p className="text-[14px] text-gray-500 mb-6">Redeem <strong className="text-gray-900">{confirmItem.title}</strong> from {confirmItem.merchant_name || 'this store'}?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)} className="flex-1 py-3.5 rounded-[14px] bg-gray-100 text-gray-700 font-bold text-[14px] active:scale-[0.98] transition-transform">
                Cancel
              </button>
              <button
                onClick={() => handleRedeem(confirmItem.id)}
                disabled={redeeming}
                className="flex-[2] py-3.5 rounded-[14px] bg-[#087a4b] text-white font-bold text-[14px] shadow-md shadow-green-600/20 active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {redeeming ? 'Redeeming...' : 'Yes, Redeem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg text-white text-[13px] font-bold transition-all ${toastMsg.ok ? 'bg-[#087a4b]' : 'bg-red-500'}`}>
          {toastMsg.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toastMsg.text}
        </div>
      )}
    </div>
  );
}
