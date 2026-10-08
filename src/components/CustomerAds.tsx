import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Gift, ListPlus, Store } from 'lucide-react';
import { apiFetch } from '../api';

type Ad = { id: string; title: string; description: string; theme: string; icon: string; action: string; url: string; test: boolean };
const themes: Record<string, string> = { blue: 'from-blue-600 to-cyan-500', purple: 'from-violet-600 to-fuchsia-500', green: 'from-emerald-700 to-teal-500' };

export function CustomerAds() {
  const slider = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const ads = useQuery({ queryKey: ['customer', 'ads'], queryFn: () => apiFetch<{ ads: Ad[] }>('/api/customer/ads'), staleTime: 60_000 });
  if (ads.isPending) return <p className="text-sm text-gray-500">Loading ads…</p>;
  if (ads.isError) return <div className="text-sm text-gray-500">Ads are unavailable. <button type="button" className="text-blue-600" onClick={() => void ads.refetch()}>Retry</button></div>;
  if (!ads.data.ads.length) return null;
  const selected = Math.min(active, ads.data.ads.length - 1);
  const goTo = (index: number) => {
    const element = slider.current;
    if (!element) return;
    element.scrollTo({ left: index * element.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <section aria-label="AE advertisements" aria-roledescription="carousel">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Discover with AE</h2><span className="text-xs text-gray-500">Advertisements</span></div>
    <div ref={slider} className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl" style={{ scrollbarWidth: 'none' }} onScroll={event => { const element = event.currentTarget; if (element.clientWidth) setActive(Math.round(element.scrollLeft / element.clientWidth)); }}>
      {ads.data.ads.map((ad, index) => {
        const Icon = ad.icon === 'gift' ? Gift : ad.icon === 'list' ? ListPlus : Store;
        return <Link key={ad.id} aria-label={`${index + 1} of ${ads.data.ads.length}: ${ad.title}. ${ad.action}`} to={ad.url.startsWith('/customer/') ? ad.url : '/customer/explore'} className={`relative block w-full shrink-0 snap-start overflow-hidden rounded-2xl bg-gradient-to-br ${themes[ad.theme] || themes.blue} px-4 py-3 text-white shadow-sm`}>
          <div className="mb-2 flex items-center justify-between"><span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold">{ad.test ? 'Test ad · Demo only' : 'Sponsored'}</span><Icon size={22} aria-hidden="true"/></div>
          <h3 className="text-sm font-bold leading-tight">{ad.title}</h3><p className="mt-1 text-xs leading-snug text-white/90">{ad.description}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold">{ad.action}<ArrowUpRight size={14}/></span>
        </Link>;
      })}
    </div>
    <div className="mt-2 flex items-center justify-center" aria-label="Choose advertisement">{ads.data.ads.map((ad, index) => <button key={ad.id} type="button" aria-label={`Show ad ${index + 1}: ${ad.title}`} aria-current={selected === index ? 'true' : undefined} onClick={() => goTo(index)} className="flex h-10 w-10 items-center justify-center"><span className={`block h-2 rounded-full ${selected === index ? 'w-5 bg-blue-600' : 'w-2 bg-gray-300'}`} /></button>)}</div>
    <p className="sr-only" aria-live="polite">Advertisement {selected + 1} of {ads.data.ads.length}</p>
  </section>;
}
