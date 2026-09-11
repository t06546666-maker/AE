import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { UserProfile } from '../../types';
import { useCustomerTransactions } from '../../hooks/useCustomerData';
import { useState } from 'react';

type Tab = 'transactions' | 'summary';

export function CustomerTransactions({ user }: { user: UserProfile }) {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<Tab>('transactions');
  const { data, isLoading } = useCustomerTransactions(page);
  const transactions = data?.transactions ?? [];

  const allEarned = transactions.filter(t => t.type === 'earn').reduce((sum, t) => sum + t.points, 0);
  const allRedeemed = transactions.filter(t => t.type === 'redeem').reduce((sum, t) => sum + t.points, 0);

  const getInitials = (name?: string) => {
    if (!name) return 'AE';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (index: number) => {
    const colors = ['bg-[#e9f8f0] text-[#087a4b]', 'bg-[#fff5dc] text-[#a86100]', 'bg-[#e8f5fb] text-[#0876a9]', 'bg-[#ffedef] text-[#c43745]'];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/profile"><ArrowLeft size={24} /></Link>
          <h1 className="text-lg font-bold">Your Points</h1>
        </div>
      </header>

      <div className="px-5 pt-6 space-y-6">
        {/* Points Card */}
        <div className="bg-[#087a4b] rounded-[20px] p-5 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-center relative z-10">
            <div>
              <p className="text-[13px] font-medium text-green-50/90 mb-1">Total AE Points</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#f59e0b] rounded-full flex items-center justify-center shadow-inner">
                  <span className="text-white font-bold text-lg leading-none">★</span>
                </div>
                <span className="text-[32px] font-bold tracking-tight">{user.reward_points || 0}</span>
              </div>
            </div>
            <ChevronRight size={24} className="text-white/80" />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex justify-between px-2">
          <div className="text-center">
            <p className="text-[16px] font-bold text-gray-900">{allEarned}</p>
            <p className="text-[12px] font-medium text-gray-500">Earned</p>
          </div>
          <div className="text-center">
            <p className="text-[16px] font-bold text-gray-900">{allRedeemed}</p>
            <p className="text-[12px] font-medium text-gray-500">Redeemed</p>
          </div>
          <div className="text-center">
            <p className="text-[16px] font-bold text-[#087a4b]">{user.reward_points || 0}</p>
            <p className="text-[12px] font-medium text-gray-500">Available</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 pb-3 text-[14px] font-bold transition-colors ${
              activeTab === 'transactions'
                ? 'text-[#087a4b] border-b-2 border-[#087a4b]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 pb-3 text-[14px] font-bold transition-colors ${
              activeTab === 'summary'
                ? 'text-[#087a4b] border-b-2 border-[#087a4b]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Summary
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'transactions' ? (
          <>
            {/* Transactions List */}
            <div className="space-y-0 divide-y divide-gray-100 bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden mt-6">
              {isLoading ? (
                <div className="py-12 text-center text-gray-400">Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center text-gray-400">No transactions found.</div>
              ) : (
                transactions.map((t, idx) => (
                  <div key={t.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${getAvatarColor(idx)} rounded-full flex items-center justify-center font-bold text-sm tracking-tighter`}>
                        {getInitials(t.merchant_name)}
                      </div>
                      <div>
                        <p className="font-bold text-[16px] text-gray-900 leading-tight">{t.merchant_name || 'Store'}</p>
                        <p className="text-[12px] text-gray-400 mt-1">
                          {new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-[16px] ${t.type === 'earn' ? 'text-[#087a4b]' : 'text-[#c43745]'}`}>
                        {t.type === 'earn' ? '+' : '-'}{t.points}
                      </p>
                      <p className="text-[11px] text-gray-300 mt-1 font-medium">{t.type === 'earn' ? 'Purchase' : 'Redemption'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {data?.pagination && data.pagination.totalPages > 1 && (
              <div className="flex justify-between items-center pt-4 pb-6 px-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-sm font-bold disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500 font-medium">Page {page} of {data.pagination.totalPages}</span>
                <button
                  disabled={page === data.pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-sm font-bold disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          /* Summary Tab */
          <div className="space-y-3 mt-2">
            <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm">
              <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-4">Points Breakdown</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-[#087a4b] font-bold text-[13px]">+</div>
                    <div>
                      <p className="font-bold text-[14px] text-gray-900">Total Earned</p>
                      <p className="text-[12px] text-gray-500">From purchases</p>
                    </div>
                  </div>
                  <p className="font-bold text-[18px] text-[#087a4b]">+{allEarned}</p>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center text-red-500 font-bold text-[13px]">-</div>
                    <div>
                      <p className="font-bold text-[14px] text-gray-900">Total Redeemed</p>
                      <p className="text-[12px] text-gray-500">Used for rewards</p>
                    </div>
                  </div>
                  <p className="font-bold text-[18px] text-red-500">-{allRedeemed}</p>
                </div>
                <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#f59e0b] rounded-full flex items-center justify-center text-white font-bold text-[13px]">★</div>
                    <div>
                      <p className="font-bold text-[14px] text-gray-900">Available Balance</p>
                      <p className="text-[12px] text-gray-500">Ready to use</p>
                    </div>
                  </div>
                  <p className="font-bold text-[18px] text-gray-900">{user.reward_points || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm">
              <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-4">Activity Stats</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-[14px] p-4 text-center">
                  <p className="text-[22px] font-bold text-gray-900">{transactions.filter(t => t.type === 'earn').length}</p>
                  <p className="text-[12px] font-medium text-gray-500 mt-1">Purchases</p>
                </div>
                <div className="bg-gray-50 rounded-[14px] p-4 text-center">
                  <p className="text-[22px] font-bold text-gray-900">{transactions.filter(t => t.type === 'redeem').length}</p>
                  <p className="text-[12px] font-medium text-gray-500 mt-1">Redemptions</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
