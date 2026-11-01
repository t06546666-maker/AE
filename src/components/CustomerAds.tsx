import { uiText } from '../uiText';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, useMemo } from 'react';
import { ArrowUpRight, Gift, ListPlus, Store } from 'lucide-react';
import { apiFetch } from '../api';
import { useTranslation } from 'react-i18next';
import { CustomerOfferPreviewModal, type PreviewOfferData } from './CustomerOfferPreviewModal';

type Ad = {
  id: string;
  title: string;
  description: string;
  rawDescription?: string;
  theme: string;
  icon: string;
  action: string;
  url: string;
  test: boolean;
  imageUrl?: string;
  bannerImageUrl?: string;
  offerImageUrl?: string;
  imageUrls?: Partial<Record<'en' | 'ml', string>>;
  merchantId?: string;
  merchantName?: string;
  merchantPhone?: string;
  merchantAddress?: string;
  category?: string;
  expiresAt?: string;
};

const themes: Record<string, string> = {
  blue: 'from-blue-600 to-cyan-500',
  purple: 'from-violet-600 to-fuchsia-500',
  green: 'from-emerald-700 to-teal-500',
};

export function CustomerAds({ location }: { location?: { latitude?: number; longitude?: number } | null } = {}) {
  const { i18n } = useTranslation(undefined, { bindI18n: 'languageChanged loaded' });
  const slider = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(1);
  const [paused, setPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [previewAd, setPreviewAd] = useState<PreviewOfferData | null>(null);
  const scrollTimeout = useRef<number | null>(null);

  const ads = useQuery({
    queryKey: ['customer', 'ads', location?.latitude, location?.longitude],
    queryFn: () => {
      const params = new URLSearchParams();
      if (location?.latitude != null && location?.longitude != null) {
        params.set('latitude', String(location.latitude));
        params.set('longitude', String(location.longitude));
      }
      const qs = params.toString();
      return apiFetch<{ ads: Ad[] }>(`/api/customer/ads${qs ? '?' + qs : ''}`);
    },
    staleTime: 60_000,
  });

  const adsList = ads.data?.ads || [];
  const count = adsList.length;

  // Infinite Seamless Loop: Clone the last slide at the start, and the first slide at the end
  // [Last, 1, 2, ..., N, First] so sliding after the last slide seamlessly glides forward into slide 1!
  const displayAds = useMemo(() => {
    if (count <= 1) return adsList;
    return [adsList[count - 1], ...adsList, adsList[0]];
  }, [adsList, count]);

  // On open, randomly pick which ad banner appears first:
  useEffect(() => {
    if (count > 1 && slider.current) {
      const randomIndex = 1 + Math.floor(Math.random() * count);
      slider.current.scrollTo({ left: randomIndex * slider.current.clientWidth, behavior: 'instant' });
      setActive(randomIndex);
    }
  }, [count]);

  // Seamless boundary reset: instantly jump when landing on cloned slides so scrolling forward is infinite
  useEffect(() => {
    const element = slider.current;
    if (!element || count <= 1) return;

    const onScrollEnd = () => {
      const w = element.clientWidth;
      if (!w) return;
      const currentPos = Math.round(element.scrollLeft / w);
      if (currentPos >= count + 1) {
        element.scrollTo({ left: 1 * w, behavior: 'instant' });
        setActive(1);
      } else if (currentPos <= 0) {
        element.scrollTo({ left: count * w, behavior: 'instant' });
        setActive(count);
      }
    };

    element.addEventListener('scrollend', onScrollEnd);
    return () => element.removeEventListener('scrollend', onScrollEnd);
  }, [count]);

  // Auto-slide forward every 5 seconds (never rewinds backwards!)
  useEffect(() => {
    if (count < 2 || paused || previewAd || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      const element = slider.current;
      if (!element || document.hidden) return;
      const w = element.clientWidth;
      if (!w) return;

      const current = Math.round(element.scrollLeft / w);
      const next = current + 1;

      element.scrollTo({ left: next * w, behavior: 'smooth' });
      setActive(next);

      // If we smoothly slid to the cloned first slide (after the last slide),
      // seamlessly snap to the real first slide right as the smooth slide finishes:
      if (next >= count + 1) {
        window.setTimeout(() => {
          if (slider.current) {
            slider.current.scrollTo({ left: 1 * slider.current.clientWidth, behavior: 'instant' });
            setActive(1);
          }
        }, 450);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [count, paused, previewAd]);

  if (ads.isPending) return <p className="text-sm text-gray-500">{uiText("Loading ads…")}</p>;
  if (ads.isError) return (
    <div className="text-sm text-gray-500">
      {uiText("Ads are unavailable. ")}
      <button type="button" className="text-blue-600" onClick={() => void ads.refetch()}>{uiText("Retry")}</button>
    </div>
  );
  if (!adsList.length) return null;

  // Active dot index mapped from the infinite track (0 to count - 1)
  const activeDot = count > 1 ? ((active - 1) % count + count) % count : 0;

  const goTo = (dotIndex: number) => {
    const element = slider.current;
    if (!element) return;
    const targetIndex = count > 1 ? dotIndex + 1 : dotIndex;
    element.scrollTo({
      left: targetIndex * element.clientWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
    setActive(targetIndex);
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const w = element.clientWidth;
    if (!w) return;
    const currentPos = Math.round(element.scrollLeft / w);
    setActive(currentPos);

    if (count > 1) {
      if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current);
      scrollTimeout.current = window.setTimeout(() => {
        const pos = Math.round(element.scrollLeft / w);
        if (pos >= count + 1) {
          element.scrollTo({ left: 1 * w, behavior: 'instant' });
          setActive(1);
        } else if (pos <= 0) {
          element.scrollTo({ left: count * w, behavior: 'instant' });
          setActive(count);
        }
      }, 150);
    }
  };

  const openPreview = (ad: Ad, carouselImageUrl?: string) => {
    setPreviewAd({
      id: ad.id,
      title: ad.title,
      description: ad.rawDescription || ad.description,
      // For preview modal, display the detailed portrait offer poster
      imageUrl: ad.offerImageUrl || ad.imageUrl || carouselImageUrl,
      bannerImageUrl: ad.bannerImageUrl,
      merchantName: ad.merchantName,
      merchantPhone: ad.merchantPhone,
      merchantAddress: ad.merchantAddress,
      category: ad.category,
      expiresAt: ad.expiresAt,
      url: ad.url,
    });
  };

  return (
    <>
      <section
        aria-label={uiText("AE advertisements")}
        aria-roledescription="carousel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
      >
        <div
          ref={slider}
          className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl"
          style={{ scrollbarWidth: 'none' }}
          onScroll={handleScroll}
        >
          {displayAds.map((ad, index) => {
            const imageUrl = ad.bannerImageUrl || ad.imageUrls?.[i18n.resolvedLanguage === 'ml' ? 'ml' : 'en'] || ad.imageUrl;
            const Icon = ad.icon === 'gift' ? Gift : ad.icon === 'list' ? ListPlus : Store;
            const slideKey = `${ad.id}-slide-${index}`;

            if (imageUrl && !failedImages.includes(imageUrl)) {
              return (
                <div
                  key={slideKey}
                  role="button"
                  tabIndex={0}
                  aria-label={`${uiText(ad.title)}. ${uiText(ad.action)}`}
                  onClick={() => openPreview(ad, imageUrl)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPreview(ad, imageUrl); } }}
                  className="relative block h-[180px] w-full shrink-0 snap-start overflow-hidden rounded-2xl bg-blue-50 cursor-pointer shadow-sm active:scale-[0.99] transition-transform"
                >
                  <img
                    src={imageUrl}
                    alt={uiText(ad.description || ad.title)}
                    className="h-full w-full object-contain"
                    onError={() => setFailedImages(current => [...current, imageUrl])}
                  />
                </div>
              );
            }

            return (
              <div
                key={slideKey}
                role="button"
                tabIndex={0}
                aria-label={`${activeDot + 1} of ${count}: ${ad.title}. ${ad.action}`}
                onClick={() => openPreview(ad)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPreview(ad); } }}
                className={`relative flex min-h-[150px] w-full shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br ${themes[ad.theme] || themes.blue} px-4 py-3 text-white shadow-sm cursor-pointer active:scale-[0.99] transition-transform`}
              >
                <div className="relative z-10">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded-full bg-black/20 px-2 py-0.5 text-[9px] font-semibold">
                      {ad.test ? uiText("Demo") : uiText("Sponsored")}
                    </span>
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-bold leading-tight">{uiText(ad.title)}</h3>
                  <p className="mt-1 text-xs leading-snug text-white/90">{uiText(ad.description)}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold">
                    {uiText(ad.action)}
                    <ArrowUpRight size={14} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-center" aria-label={uiText("Choose advertisement")}>
          {adsList.map((ad, index) => (
            <button
              key={ad.id}
              type="button"
              aria-label={`Show ad ${index + 1}: ${ad.title}`}
              aria-current={activeDot === index ? 'true' : undefined}
              onClick={() => goTo(index)}
              className="flex h-10 w-10 items-center justify-center"
            >
              <span className={`block h-2 rounded-full ${activeDot === index ? 'w-5 bg-blue-600' : 'w-2 bg-gray-300'}`} />
            </button>
          ))}
        </div>

        <p className="sr-only" aria-live="polite">
          {uiText("Advertisement ")}{activeDot + 1}{uiText(" of ")}{count}
        </p>
        {count > 1 && (
          <button type="button" className="text-xs text-gray-500" onClick={() => setPaused(value => !value)}>
            {paused ? uiText("Play slides") : uiText("Pause slides")}
          </button>
        )}
      </section>

      {/* Full In-App Ad / Poster Preview Modal */}
      <CustomerOfferPreviewModal offer={previewAd} onClose={() => setPreviewAd(null)} />
    </>
  );
}
