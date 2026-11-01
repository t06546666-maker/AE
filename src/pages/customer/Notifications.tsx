import { uiText } from '../../uiText';
import { formatDateTime } from '../../utils';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, ExternalLink, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api';
import { useCustomerTransactions } from '../../hooks/useCustomerData';

interface Announcement {
  id: string;
  title: string;
  body: string;
  url?: string;
  created_at: string;
}

export function CustomerNotifications() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useCustomerTransactions(page);

  const { data: announcementsData, isLoading: announcementsLoading } = useQuery({
    queryKey: ['customer', 'announcements'],
    queryFn: () => apiFetch<{ announcements: Announcement[] }>('/api/customer/announcements'),
    staleTime: 60_000,
  });

  const announcements = announcementsData?.announcements || [];

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
                  <div key={item.id} className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 p-4 shadow-sm space-y-2">
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

                    {item.url && (
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
    </div>
  );
}
