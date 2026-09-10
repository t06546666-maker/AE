import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerTransactions({ user }: { user: UserProfile }) {
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
            <p className="text-[16px] font-bold text-gray-900">{(user.reward_points || 0) + 250}</p>
            <p className="text-[12px] font-medium text-gray-500">Earned</p>
          </div>
          <div className="text-center">
            <p className="text-[16px] font-bold text-gray-900">250</p>
            <p className="text-[12px] font-medium text-gray-500">Redeemed</p>
          </div>
          <div className="text-center">
            <p className="text-[16px] font-bold text-[#087a4b]">{user.reward_points || 0}</p>
            <p className="text-[12px] font-medium text-gray-500">Available</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button className="flex-1 pb-3 text-[14px] font-bold text-[#087a4b] border-b-2 border-[#087a4b]">
            Transactions
          </button>
          <button className="flex-1 pb-3 text-[14px] font-bold text-gray-400 hover:text-gray-600">
            Summary
          </button>
        </div>

        {/* Transactions List */}
        <div className="space-y-0 divide-y divide-gray-100 bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">
                FRESH
              </div>
              <div>
                <p className="font-bold text-[15px] text-gray-900 leading-tight">Fresh Mart</p>
                <p className="text-[11px] text-gray-500 mt-1">Today, 10:24 AM</p>
              </div>
            </div>
            <p className="font-bold text-[#087a4b] text-[15px]">+25</p>
          </div>
          
          <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold text-xs">
                BAKER
              </div>
              <div>
                <p className="font-bold text-[15px] text-gray-900 leading-tight">Baker's Hut</p>
                <p className="text-[11px] text-gray-500 mt-1">Yesterday, 5:12 PM</p>
              </div>
            </div>
            <p className="font-bold text-[#087a4b] text-[15px]">+10</p>
          </div>

          <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-black text-white rounded-full flex items-center justify-center font-bold text-xs">
                AE
              </div>
              <div>
                <p className="font-bold text-[15px] text-gray-900 leading-tight">AE Welcome Bonus</p>
                <p className="text-[11px] text-gray-500 mt-1">Aug 30, 2026</p>
              </div>
            </div>
            <p className="font-bold text-[#087a4b] text-[15px]">+50</p>
          </div>

          <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">
                CITY
              </div>
              <div>
                <p className="font-bold text-[15px] text-gray-900 leading-tight">City Pharmacy</p>
                <p className="text-[11px] text-gray-500 mt-1">Aug 28, 2026</p>
              </div>
            </div>
            <p className="font-bold text-[#087a4b] text-[15px]">+20</p>
          </div>

          <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-red-100 text-red-500 rounded-full flex items-center justify-center font-bold text-xs">
                GIFT
              </div>
              <div>
                <p className="font-bold text-[15px] text-gray-900 leading-tight">Redemption</p>
                <p className="text-[11px] text-gray-500 mt-1">Aug 25, 2026</p>
              </div>
            </div>
            <p className="font-bold text-red-500 text-[15px]">-100</p>
          </div>
        </div>
      </div>
    </div>
  );
}
