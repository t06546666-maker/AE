import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Gift, ListPlus, Store } from 'lucide-react';
import { apiFetch } from '../api';

type Ad = { id: string; title: string; description: string; theme: string; icon: string; action: string; url: string; test: boolean };
const themes: Record<string, string> = { blue: 'from-blue-600 to-cyan-500', purple: 'from-violet-600 to-fuchsia-500', green: 'from-emerald-700 to-teal-500' };

export function CustomerAds() {
  const ads = useQuery({ queryKey: ['customer', 'ads'], queryFn: () => apiFetch<{ ads: Ad[] }>('/api/customer/ads'), staleTime: 60_000 });
  if (ads.isPending) return <p className="text-sm text-gray-500">Loading ads…</p>;
  if (ads.isError) return <div className="text-sm text-gray-500">Ads are unavailable. <button type="button" className="text-blue-600" onClick={() => void ads.refetch()}>Retry</button></div>;
  if (!ads.data.ads.length) return null;
  return <section aria-label="AE advertisements">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Discover with AE</h2><span className="text-xs text-gray-500">Advertisements</span></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ads.data.ads.map(ad => {
        const Icon = ad.icon === 'gift' ? Gift : ad.icon === 'list' ? ListPlus : Store;
        return <Link key={ad.id} to={ad.url.startsWith('/customer/') ? ad.url : '/customer/explore'} className={`relative block overflow-hidden rounded-2xl bg-gradient-to-br ${themes[ad.theme] || themes.blue} p-5 text-white shadow-sm`}>
          <div className="mb-5 flex items-center justify-between"><span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-semibold">{ad.test ? 'Test ad · Demo only' : 'Sponsored'}</span><Icon size={32} aria-hidden="true"/></div>
          <h3 className="text-lg font-bold leading-tight">{ad.title}</h3><p className="mt-2 text-sm text-white/90">{ad.description}</p>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">{ad.action}<ArrowUpRight size={17}/></span>
        </Link>;
      })}
    </div>
  </section>;
}
