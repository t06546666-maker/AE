import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ExternalLink, Sparkles } from 'lucide-react';
import { apiFetch } from '../api';
import { uiText } from '../uiText';
import type { AdBanner } from '../types';
import { CustomerOfferPreviewModal, type PreviewOfferData } from './CustomerOfferPreviewModal';

export function CustomerDownsideBanners() {
  const navigate = useNavigate();
  const sliderRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [selectedPreview, setSelectedPreview] = useState<PreviewOfferData | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customer', 'banners', 'downside'],
    queryFn: () => apiFetch<{ banners: AdBanner[] }>('/api/customer/banners?placement=downside'),
    staleTime: 60_000,
  });

  const banners = data?.banners || [];
  const count = banners.length;

  useEffect(() => {
    if (count <= 1) return;
    const interval = window.setInterval(() => {
      if (!sliderRef.current || document.hidden) return;
      const next = (active + 1) % count;
      setActive(next);
      sliderRef.current.scrollTo({
        left: next * sliderRef.current.clientWidth,
        behavior: 'smooth',
      });
    }, 6000);
    return () => window.clearInterval(interval);
  }, [count, active]);

  if (isLoading || count === 0) {
    return null;
  }

  const handleBannerClick = (banner: AdBanner) => {
    if (banner.linkType === 'explore') {
      navigate('/customer/explore');
    } else if (banner.linkType === 'merchant') {
      if (banner.linkValue) {
        navigate(`/customer/explore?search=${encodeURIComponent(banner.linkValue)}`);
      } else {
        navigate('/customer/explore');
      }
    } else if (banner.linkType === 'offer') {
      setSelectedPreview({
        id: banner.id,
        title: banner.title,
        description: banner.subtitle || '',
        imageUrl: banner.imageUrl,
        bannerImageUrl: banner.imageUrl,
        url: '/customer/offers',
      });
    } else if (banner.linkType === 'external') {
      if (banner.linkValue && (banner.linkValue.startsWith('http://') || banner.linkValue.startsWith('https://'))) {
        window.open(banner.linkValue, '_blank', 'noopener,noreferrer');
      } else {
        setSelectedPreview({
          id: banner.id,
          title: banner.title,
          description: banner.subtitle || '',
          imageUrl: banner.imageUrl,
          bannerImageUrl: banner.imageUrl,
        });
      }
    } else {
      setSelectedPreview({
        id: banner.id,
        title: banner.title,
        description: banner.subtitle || '',
        imageUrl: banner.imageUrl,
        bannerImageUrl: banner.imageUrl,
      });
    }
  };

  return (
    <>
      <section className="customer-downside-banners space-y-2 pt-2" aria-label={uiText("Featured Promotions")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Sparkles size={12} />
            </span>
            <h3 className="text-[14px] font-bold text-gray-900">{uiText("Featured Promotions")}</h3>
          </div>
          {count > 1 && (
            <div className="flex items-center gap-1">
              {banners.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === active ? 'w-4 bg-emerald-600' : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div
          ref={sliderRef}
          className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.clientWidth) {
              setActive(Math.round(el.scrollLeft / el.clientWidth));
            }
          }}
        >
          {banners.map((banner) => (
            <div
              key={banner.id}
              role="button"
              tabIndex={0}
              onClick={() => handleBannerClick(banner)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleBannerClick(banner);
                }
              }}
              className="relative w-full shrink-0 snap-start overflow-hidden rounded-[18px] border border-gray-100 bg-white shadow-sm active:scale-[0.99] transition-transform cursor-pointer group"
            >
              <div className="relative aspect-[21/9] w-full overflow-hidden bg-slate-900">
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                  <div className="min-w-0 pr-2">
                    <p className="line-clamp-1 text-[14px] font-bold drop-shadow-sm">{banner.title}</p>
                    {banner.subtitle && (
                      <p className="line-clamp-1 text-[11px] text-gray-200 drop-shadow-sm">{banner.subtitle}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-white/20 backdrop-blur-md p-1.5 text-white shadow-sm">
                    {banner.linkType === 'external' ? <ExternalLink size={14} /> : <ChevronRight size={14} />}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CustomerOfferPreviewModal offer={selectedPreview} onClose={() => setSelectedPreview(null)} />
    </>
  );
}
