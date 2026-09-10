import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronRight, QrCode, Gift, Tag, MapPin, Search } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerHome({ user }: { user: UserProfile }) {
  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <ArrowLeft size={24} className="text-gray-800" />
          <h1 className="text-xl font-bold tracking-tight">AE</h1>
        </div>
        <Link to="/customer/notifications" className="relative text-gray-800">
          <Bell size={24} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </Link>
      </header>

      <div className="px-5 pt-6 space-y-6">
        {/* Greeting */}
        <div>
          <h2 className="text-[22px] font-bold text-gray-900 mb-1">Hi, {user.name?.split(' ')[0] || user.phone || 'Sharon'}! 👋</h2>
          <p className="text-[13px] text-gray-500 font-medium">Shop Local. Earn More.</p>
        </div>

        {/* Points Card */}
        <Link to="/customer/transactions" className="block bg-[#087a4b] rounded-[20px] p-5 text-white shadow-lg relative overflow-hidden active:scale-[0.98] transition-transform">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-center relative z-10">
            <div>
              <p className="text-[13px] font-medium text-green-50/90 mb-1">Your AE Points</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#f59e0b] rounded-full flex items-center justify-center shadow-inner">
                  <span className="text-white font-bold text-lg leading-none">★</span>
                </div>
                <span className="text-[32px] font-bold tracking-tight">{user.reward_points || 0}</span>
              </div>
            </div>
            <ChevronRight size={24} className="text-white/80" />
          </div>
        </Link>

        {/* Action Grid */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          <Link to="/customer/scan" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#087a4b] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100">
              <QrCode size={24} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">Scan &<br/>Earn</span>
          </Link>
          <Link to="/customer/rewards" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-purple-500 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100">
              <Gift size={24} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight mt-3">Rewards</span>
          </Link>
          <Link to="/customer/offers" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-500 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100">
              <Tag size={24} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight mt-3">Offers</span>
          </Link>
          <Link to="/customer/explore" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100">
              <MapPin size={24} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight mt-3">Nearby</span>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="pt-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[17px] font-bold text-gray-900">Recent Activity</h3>
            <button className="text-[13px] font-bold text-[#087a4b]">View All</button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] divide-y divide-gray-50">
            <div className="p-4 flex items-center justify-between">
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
            <div className="p-4 flex items-center justify-between">
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
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">
                  CITY
                </div>
                <div>
                  <p className="font-bold text-[15px] text-gray-900 leading-tight">City Pharmacy</p>
                  <p className="text-[11px] text-gray-500 mt-1">Aug 30, 2026</p>
                </div>
              </div>
              <p className="font-bold text-[#087a4b] text-[15px]">+50</p>
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-bold text-[16px] text-gray-900 leading-tight">More Shopping<br/>More Rewards</h3>
          </div>
          <div className="relative z-10 text-emerald-500">
            <Gift size={40} />
          </div>
        </div>
      </div>
    </div>
  );
}
