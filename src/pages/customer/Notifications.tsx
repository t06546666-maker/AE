import { uiText } from '../../uiText';
import { formatDateTime } from '../../utils';
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bell, ExternalLink, Sparkles, Maximize2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api';
import { useCustomerTransactions } from '../../hooks/useCustomerData';

interface Announcement {
  id: string;
  title: string;
  body: string;
  url?: string;
  image_url?: string;
  created_at: string;
}

export function CustomerNotifications() {
  const [page, setPage] = useState(1);
  const [searchParams] = useSearchParams();
  const [fullViewItem, setFullViewItem] = useState<Announcement | null>(null);
  const { data, isLoading, error, refetch } = useCustomerTransactions(page);

  const { data: announcementsData, isLoading: announcementsLoading } = useQuery({
    queryKey: ['customer', 'announcements'],
    queryFn: () => apiFetch<{ announcements: Announcement[] }>('/api/customer/announcements'),
    staleTime: 60_000,
  });

  const announcements = announcementsData?.announcements || [];

  // Automatically open the full image if opened from a push notification tap (?viewImage=... or ?announcementId=...)
  useEffect(() => {
    const viewImageUrl = searchParams.get('viewImage');
    const announcementId = searchParams.get('announcementId');

    if (viewImageUrl) {
      const match = announcements.find(a => a.image_url === viewImageUrl);
      if (match) {
        setFullViewItem(match);
      } else {
        setFullViewItem({
          id: 'push-image-preview',
          title: uiText('Notification Image'),
          body: '',
          image_url: viewImageUrl,
          created_at: new Date().toISOString(),
        });
      }
    } else if (announcementId && announcements.length > 0) {
      const match = announcements.find(a => a.id === announcementId);
      if (match && match.image_url) {
        setFullViewItem(match);
      }
    }
  }, [searchParams, announcements]);

  return (
    <div className="min-h-screen bg-gray-50 pb-28 text-gray-900">
      <header className="flex items-center gap-4 bg-white px-5 py-4 shadow-sm sticky top-0 z-10 border-b border-gray-100">
        <Link to="/customer/home" aria-label={uiText("Back")}>
          <ArrowLeft />
        </Link>
        <h1 className="text-lg font-bold">{uiText("Notifications")}</h1>
      </header>

      <main className="space-y-5 p-4 max-w-lg mx-auto">
        {/* Important Announcements & Guides */}
        {announcements.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5 px-1">
              <Sparkles size={16} className="text-amber-500" />
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                {uiText("Announcements & Guides")}
              </h2>
            </div>

            <div className="space-y-3">
              {announcements.map((item) => {
                const isExternal = typeof item.url === 'string' && (item.url.startsWith('http://') || item.url.startsWith('https://'));
                return (
                  <div key={item.id} className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 p-4 shadow-sm space-y-2.5">
                    {item.image_url && (
                      <div
                        className="relative overflow-hidden rounded-xl border border-blue-100/60 bg-slate-900/5 shadow-xs cursor-pointer group"
                        onClick={() => setFullViewItem(item)}
                        title={uiText("Tap to view full image")}
                      >
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full max-h-96 object-contain mx-auto transition-transform duration-200 group-hover:scale-[1.01]"
                          loading="lazy"
                        />
                        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-bold shadow-md hover:bg-black/85 transition-colors pointer-events-none">
                          <Maximize2 size={12} />
                          <span>{uiText("Full View")}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <Bell size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[15px] text-gray-900 leading-tight">{item.title}</h3>
                        <p className="mt-1 text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{item.body}</p>
                        <time className="mt-2 block text-[11px] font-medium text-gray-400">{formatDateTime(item.created_at)}</time>
                      </div>
                    </div>

                    {item.url && !item.url.startsWith('/customer/notifications') && !item.url.startsWith('/notifications') && (
                      <div className="pt-1 pl-11">
                        {isExternal ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors"
                          >
                            <span>{uiText("Open Post / Guide")}</span>
                            <ExternalLink size={13} />
                          </a>
                        ) : (
                          <Link
                            to={item.url}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors"
                          >
                            <span>{uiText("View in App")}</span>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Purchase & Redemption Activity */}
        <section className="space-y-2.5">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide px-1">
            {uiText("Activity & Rewards")}
          </h2>

          {isLoading && <p className="text-sm text-gray-500 py-4 text-center">{uiText("Loading…")}</p>}

          {error && (
            <div role="alert" className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">
              <p>{error.message}</p>
              <button className="font-bold underline mt-2" onClick={() => void refetch()}>{uiText("Try again")}</button>
            </div>
          )}

          {!isLoading && !error && !data?.transactions.length && announcements.length === 0 && (
            <p className="text-sm text-gray-400 py-6 text-center">{uiText("No notifications yet.")}</p>
          )}

          <div className="space-y-2.5">
            {data?.transactions.map(item => (
              <Link key={`${item.type}-${item.id}`} to="/customer/transactions" className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm border border-gray-100 hover:border-gray-200 transition-colors">
                <Bell className="shrink-0 text-emerald-600 mt-1" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[14px] text-gray-900 leading-tight">
                    {item.type === 'bonus'
                      ? uiText("Points added to your account")
                      : `₹${Number(item.amount || 0).toLocaleString('en-IN')} ${item.type === 'earn' ? uiText("purchase") : uiText("redemption")}`}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {Number(item.points).toLocaleString('en-IN')}{uiText(" points ")}
                    {item.type !== 'redeem' ? uiText("earned") : uiText("redeemed")} · {item.merchant_name || 'AE Merchant'}
                  </p>
                  {item.reason && <p className="text-xs text-gray-500 mt-0.5">{uiText('Reason')}: {item.reason}</p>}
                  {item.type === 'bonus' && (
                    <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                      {uiText("You received ")}{Number(item.points).toLocaleString('en-IN')}{uiText(" AE loyalty points. Thank you for your loyalty!")}
                    </p>
                  )}
                  <time className="block text-[11px] text-gray-400 mt-1.5">{formatDateTime(item.created_at)}</time>
                </div>
              </Link>
            ))}
          </div>

          {data && data.pagination.totalPages > 1 && (
            <div className="flex justify-between pt-2">
              <button disabled={page === 1} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 bg-white disabled:opacity-40" onClick={() => setPage(page - 1)}>
                {uiText("Previous")}
              </button>
              <button disabled={page >= data.pagination.totalPages} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 bg-white disabled:opacity-40" onClick={() => setPage(page + 1)}>
                {uiText("Next")}
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Fullscreen Image Lightbox Modal */}
      {fullViewItem && fullViewItem.image_url && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setFullViewItem(null)}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between gap-3 text-white max-w-xl w-full mx-auto pb-3 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base text-white truncate">
                {fullViewItem.title || uiText("Notification Image")}
              </h3>
              <span className="text-xs text-gray-400 block mt-0.5">
                {formatDateTime(fullViewItem.created_at)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFullViewItem(null)}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              aria-label={uiText("Close")}
            >
              <X size={20} />
            </button>
          </div>

          {/* Center Image Container - full natural uncropped resolution */}
          <div
            className="flex-1 flex items-center justify-center my-4 overflow-hidden w-full max-w-2xl mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={fullViewItem.image_url}
              alt={fullViewItem.title}
              className="max-h-[68vh] max-w-full w-auto h-auto object-contain rounded-xl shadow-2xl"
            />
          </div>

          {/* Bottom Details Panel */}
          <div
            className="max-w-xl w-full mx-auto bg-white/10 backdrop-blur-lg rounded-2xl p-4 text-white border border-white/15 space-y-2.5 mb-2"
            onClick={(e) => e.stopPropagation()}
          >
            {fullViewItem.body && (
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto">
                {fullViewItem.body}
              </p>
            )}

            {fullViewItem.url && !fullViewItem.url.startsWith('/customer/notifications') && !fullViewItem.url.startsWith('/notifications') && (
              <div className="pt-1">
                {fullViewItem.url.startsWith('http://') || fullViewItem.url.startsWith('https://') ? (
                  <a
                    href={fullViewItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md transition-colors"
                  >
                    <span>{uiText("Open Link / Guide")}</span>
                    <ExternalLink size={15} />
                  </a>
                ) : (
                  <Link
                    to={fullViewItem.url}
                    onClick={() => setFullViewItem(null)}
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md transition-colors"
                  >
                    <span>{uiText("View in App")}</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
