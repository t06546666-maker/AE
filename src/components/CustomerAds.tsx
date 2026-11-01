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
  const [currentIndex, setCurrentIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [previewAd, setPreviewAd] = useState<PreviewOfferData | null>(null);

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);
  const isSwiping = useRef(false);
  const hasRandomized = useRef(false);

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

  // Infinite Seamless Loop: Clone the last slide at start, and first slide at end
  // [LastSlide (index 0), Slide 1 (index 1), ..., Slide N (index N), FirstSlide (index N+1)]
  const displayAds = useMemo(() => {
    if (count <= 1) return adsList;
    return [adsList[count - 1], ...adsList, adsList[0]];
  }, [adsList, count]);

  // On initial open, randomly pick which ad banner appears first without animation:
  useEffect(() => {
    if (count > 1 && !hasRandomized.current) {
      hasRandomized.current = true;
      const randomIndex = 1 + Math.floor(Math.random() * count);
      setIsTransitioning(false);
      setCurrentIndex(randomIndex);
      const timer = window.setTimeout(() => setIsTransitioning(true), 50);
      return () => window.clearTimeout(timer);
    } else if (count === 1) {
      setCurrentIndex(0);
    }
  }, [count]);

  // Handle seamless boundary wrap when CSS transition ends:
  const handleTransitionEnd = () => {
    if (count <= 1) return;
    if (currentIndex >= count + 1) {
      // Reached cloned FirstSlide (after LastSlide): snap invisibly to real Slide 1
      setIsTransitioning(false);
      setCurrentIndex(1);
    } else if (currentIndex <= 0) {
      // Reached cloned LastSlide (before Slide 1): snap invisibly to real LastSlide
      setIsTransitioning(false);
      setCurrentIndex(count);
    }
  };

  // Re-enable smooth transition after instant snap
  useEffect(() => {
    if (!isTransitioning && count > 1) {
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          setIsTransitioning(true);
        });
        return () => cancelAnimationFrame(raf2);
      });
      return () => cancelAnimationFrame(raf1);
    }
  }, [isTransitioning, count]);

  // Safety fallback for transitionend in case tab is in background or animation cancelled
  useEffect(() => {
    if (count <= 1) return;
    if (currentIndex >= count + 1) {
      const timer = window.setTimeout(() => {
        setIsTransitioning(false);
        setCurrentIndex(1);
      }, 500);
      return () => window.clearTimeout(timer);
    } else if (currentIndex <= 0) {
      const timer = window.setTimeout(() => {
        setIsTransitioning(false);
        setCurrentIndex(count);
      }, 500);
      return () => window.clearTimeout(timer);
    }
  }, [currentIndex, count]);

  // Auto-slide forward every 5 seconds (Always glides forward, never rewinds!)
  useEffect(() => {
    if (count < 2 || paused || previewAd || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setIsTransitioning(true);
      setCurrentIndex((prev) => prev + 1);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [count, paused, previewAd]);

  // Touch Swipe Handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setPaused(true);
    setTouchStartX(e.touches[0].clientX);
    setTouchDeltaX(0);
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || count <= 1) return;
    const delta = e.touches[0].clientX - touchStartX;
    setTouchDeltaX(delta);
    if (Math.abs(delta) > 10) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX !== null && count > 1) {
      const threshold = 40;
      if (touchDeltaX < -threshold) {
        // Swiped left -> glide forward into next slide
        setIsTransitioning(true);
        setCurrentIndex((prev) => prev + 1);
      } else if (touchDeltaX > threshold) {
        // Swiped right -> glide backward into previous slide
        setIsTransitioning(true);
        setCurrentIndex((prev) => prev - 1);
      } else {
        // Snap back to current
        setIsTransitioning(true);
      }
    }
    setTouchStartX(null);
    setTouchDeltaX(0);
    setPaused(false);
    window.setTimeout(() => {
      isSwiping.current = false;
    }, 100);
  };

  // Active dot index mapped from the infinite track (0 to count - 1)
  const activeDot = count > 1 ? ((currentIndex - 1) % count + count) % count : 0;

  const goTo = (dotIndex: number) => {
    if (count <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex(dotIndex + 1);
  };

  const openPreview = (ad: Ad, carouselImageUrl?: string) => {
    if (isSwiping.current) return;
    setPreviewAd({
      id: ad.id,
      title: ad.title,
      description: ad.rawDescription || ad.description,
      // For preview modal, display detailed portrait offer poster
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

  const transformStyle = useMemo(() => {
    if (count <= 1) return { transform: 'none' };
    if (touchStartX !== null && touchDeltaX !== 0) {
      return {
        transform: `translateX(calc(-${currentIndex * 100}% + ${touchDeltaX}px))`,
        transition: 'none',
        willChange: 'transform',
      };
    }
    return {
      transform: `translateX(-${currentIndex * 100}%)`,
      transition: isTransitioning ? 'transform 450ms cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
      willChange: 'transform',
    };
  }, [count, currentIndex, isTransitioning, touchStartX, touchDeltaX]);

  if (ads.isPending) return <p className="text-sm text-gray-500">{uiText("Loading ads…")}</p>;
  if (ads.isError) return (
    <div className="text-sm text-gray-500">
      {uiText("Ads are unavailable. ")}
      <button type="button" className="text-blue-600" onClick={() => void ads.refetch()}>{uiText("Retry")}</button>
    </div>
  );
  if (!adsList.length) return null;

  return (
    <>
      <section
        aria-label={uiText("AE advertisements")}
        aria-roledescription="carousel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
      >
        <div
          className="relative overflow-hidden rounded-2xl w-full touch-pan-y select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex w-full"
            style={transformStyle}
            onTransitionEnd={handleTransitionEnd}
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
                    className="relative block h-[180px] w-full min-w-full shrink-0 overflow-hidden rounded-2xl bg-blue-50 cursor-pointer shadow-sm active:scale-[0.99] transition-transform"
                  >
                    <img
                      src={imageUrl}
                      alt={uiText(ad.description || ad.title)}
                      className="h-full w-full object-contain pointer-events-none"
                      onError={() => setFailedImages((current) => [...current, imageUrl])}
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
                  className={`relative flex min-h-[150px] w-full min-w-full shrink-0 flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br ${themes[ad.theme] || themes.blue} px-4 py-3 text-white shadow-sm cursor-pointer active:scale-[0.99] transition-transform`}
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
        </div>

        {count > 1 && (
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
                <span className={`block h-2 rounded-full transition-all duration-300 ${activeDot === index ? 'w-5 bg-blue-600' : 'w-2 bg-gray-300'}`} />
              </button>
            ))}
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {uiText("Advertisement ")}{activeDot + 1}{uiText(" of ")}{count}
        </p>
        {count > 1 && (
          <button type="button" className="text-xs text-gray-500" onClick={() => setPaused((value) => !value)}>
            {paused ? uiText("Play slides") : uiText("Pause slides")}
          </button>
        )}
      </section>

      {/* Full In-App Ad / Poster Preview Modal */}
      <CustomerOfferPreviewModal offer={previewAd} onClose={() => setPreviewAd(null)} />
    </>
  );
}
