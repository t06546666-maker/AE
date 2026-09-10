import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronRight, Scan, Gift, Tag, MapPin, Star } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerHome({ user }: { user: UserProfile }) {
  return (
    <div className="bg-white min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-4 py-4 bg-white sticky top-0 z-10">
        <ArrowLeft size={24} className="text-gray-800" />
        <h1 className="text-[22px] font-black tracking-tighter absolute left-1/2 transform -translate-x-1/2">AE</h1>
        <Link to="/customer/notifications" className="relative text-gray-800">
          <Bell size={24} />
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-[1.5px] border-white"></span>
        </Link>
      </header>

      <div className="px-4 pt-2 space-y-6">
        {/* Greeting */}
        <div>
          <h2 className="text-[20px] font-bold text-gray-900 mb-0.5 flex items-center gap-1">
            Hi, {user.name?.split(' ')[0] || user.phone || 'Sharon'}! <span className="text-[20px]">👋</span>
          </h2>
          <p className="text-[13px] text-gray-500 font-medium tracking-wide">Shop Local. Earn More.</p>
        </div>

        {/* Points Card */}
        <Link to="/customer/transactions" className="block bg-[#087a4b] rounded-[16px] p-5 text-white shadow-md relative overflow-hidden active:scale-[0.98] transition-transform w-full">
          <div className="flex justify-between items-center relative z-10">
            <div>
              <p className="text-[13px] font-medium text-green-50 mb-1">Your AE Points</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#f59e0b] rounded-full flex items-center justify-center shadow-inner">
                  <Star className="text-white fill-white" size={16} />
                </div>
                <span className="text-[32px] font-bold tracking-tight">{user.reward_points || '1,250'}</span>
              </div>
            </div>
            <ChevronRight size={20} className="text-white" />
          </div>
        </Link>

        {/* Action Grid */}
        <div className="flex justify-between items-start pt-1">
          <Link to="/customer/scan" className="flex flex-col items-center gap-2">
            <div className="w-[60px] h-[60px] bg-[#e6fcf2] rounded-[18px] flex items-center justify-center text-[#087a4b] active:scale-[0.95] transition-transform">
              <Scan size={26} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold text-gray-800 text-center leading-tight">Scan &<br/>Earn</span>
          </Link>
          <Link to="/customer/rewards" className="flex flex-col items-center gap-2">
            <div className="w-[60px] h-[60px] bg-[#fdf2f8] rounded-[18px] flex items-center justify-center text-[#c026d3] active:scale-[0.95] transition-transform">
              <Gift size={26} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold text-gray-800 text-center leading-tight">Rewards</span>
          </Link>
          <Link to="/customer/offers" className="flex flex-col items-center gap-2">
            <div className="w-[60px] h-[60px] bg-[#eff6ff] rounded-[18px] flex items-center justify-center text-[#3b82f6] active:scale-[0.95] transition-transform">
              <Tag size={26} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold text-gray-800 text-center leading-tight">Offers</span>
          </Link>
          <Link to="/customer/explore" className="flex flex-col items-center gap-2">
            <div className="w-[60px] h-[60px] bg-[#f0fdf4] rounded-[18px] flex items-center justify-center text-[#22c55e] active:scale-[0.95] transition-transform">
              <MapPin size={26} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold text-gray-800 text-center leading-tight">Nearby</span>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="pt-2">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-[16px] font-bold text-gray-900 tracking-wide">Recent Activity</h3>
            <button className="text-[12px] font-bold text-[#22c55e]">View All</button>
          </div>
          <div className="space-y-0 divide-y divide-gray-100 border-t border-gray-100">
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] bg-[#22c55e] text-white rounded-full flex items-center justify-center font-bold text-[8px] leading-tight text-center">
                  FRESH<br/>MART
                </div>
                <div>
                  <p className="font-bold text-[14px] text-gray-900 leading-tight">Fresh Mart</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Today, 10:24 AM</p>
                </div>
              </div>
              <p className="font-bold text-[#22c55e] text-[14px]">+25</p>
            </div>
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] bg-[#d97706] text-white rounded-full flex items-center justify-center font-bold text-[8px] leading-tight text-center">
                  BAKER'S<br/>HUT
                </div>
                <div>
                  <p className="font-bold text-[14px] text-gray-900 leading-tight">Baker's Hut</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Yesterday, 5:12 PM</p>
                </div>
              </div>
              <p className="font-bold text-[#22c55e] text-[14px]">+10</p>
            </div>
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] bg-[#0ea5e9] text-white rounded-full flex items-center justify-center font-bold text-[8px] leading-tight text-center">
                  CITY<br/>PHARM
                </div>
                <div>
                  <p className="font-bold text-[14px] text-gray-900 leading-tight">City Pharmacy</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Aug 30, 2026</p>
                </div>
              </div>
              <p className="font-bold text-[#22c55e] text-[14px]">+50</p>
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="bg-[#e8faee] rounded-[16px] p-4 flex items-center justify-between shadow-sm relative overflow-hidden mt-2 border border-green-50">
          <div className="relative z-10">
            <h3 className="font-bold text-[15px] text-gray-900 leading-tight tracking-wide">More Shopping<br/>More Rewards</h3>
          </div>
          <div className="relative z-10 text-[#facc15]">
            <Gift size={40} strokeWidth={1.5} />
          </div>
        </div>
      </div>
    </div>
  );
}
