import { ArrowLeft, Heart, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCustomerMerchants } from '../../hooks/useCustomerData';

export function CustomerFavorites() {
  const ids: string[] = JSON.parse(localStorage.getItem('ae_favorite_merchants') || '[]');
  const { data, isLoading } = useCustomerMerchants(1);
  const favorites = (data?.merchants || []).filter((merchant) => ids.includes(merchant.id));

  return <div className="min-h-screen bg-gray-50 pb-28 text-gray-900">
    <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-gray-100 bg-white px-5 py-4">
      <Link to="/customer/profile" aria-label="Back to profile"><ArrowLeft size={23} /></Link>
      <h1 className="text-lg font-bold">My Favorite Stores</h1>
    </header>
    <main className="space-y-3 px-5 py-5">
      {isLoading ? <p className="py-12 text-center text-sm text-gray-400">Loading favorites...</p> : favorites.length ? favorites.map((merchant) => <Link key={merchant.id} to="/customer/explore" className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 font-bold text-[#087a4b]">{merchant.merchant_name.slice(0, 2).toUpperCase()}</div>
        <div className="min-w-0 flex-1"><h2 className="font-bold">{merchant.merchant_name}</h2><p className="text-xs text-gray-500">{merchant.category || 'AE Merchant'}</p>{merchant.address ? <p className="mt-1 flex items-center gap-1 text-xs text-gray-400"><MapPin size={12} />{merchant.address}</p> : null}</div>
        <Heart size={19} className="fill-red-500 text-red-500" />
      </Link>) : <div className="rounded-2xl bg-white px-5 py-12 text-center shadow-sm"><Heart className="mx-auto mb-3 text-gray-300" size={34} /><p className="font-semibold">No favorite stores yet</p><p className="mt-1 text-xs text-gray-500">Tap the heart icon on a merchant to save it here.</p><Link to="/customer/explore" className="mt-5 inline-block rounded-full bg-[#087a4b] px-5 py-2 text-sm font-bold text-white">Browse merchants</Link></div>}
    </main>
  </div>;
}
