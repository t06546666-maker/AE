import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronRight, QrCode, Gift, Tag, MapPin } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerHome({ user }: { user: UserProfile }) {
  return (
    <div className="bg-white min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10">
        <ArrowLeft size={24} className="text-gray-800" />
        <h1 className="text-2xl font-black tracking-tighter absolute left-1/2 transform -translate-x-1/2">AE</h1>
        <Link to="/customer/notifications" className="relative text-gray-800">
          <Bell size={24} />
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </Link>
      </header>

      <div className="px-5 pt-4 space-y-7">
        {/* Greeting */}
        <div>
          <h2 className="text-[22px] font-bold text-gray-900 mb-1 flex items-center gap-2">
            Hi, {user.name?.split(' ')[0] || user.phone || 'Sharon'}! <span className="text-2xl">👋</span>
          </h2>
          <p className="text-[14px] text-gray-500 font-medium tracking-wide">Shop Local. Earn More.</p>
        </div>

        {/* Points Card */}
        <Link to="/customer/transactions" className="block bg-[#087a4b] rounded-[24px] p-6 text-white shadow-[0_8px_20px_rgba(8,122,75,0.25)] relative overflow-hidden active:scale-[0.98] transition-transform">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-center relative z-10">
            <div>
              <p className="text-[14px] font-medium text-green-50 mb-2">Your AE Points</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#f59e0b] rounded-full flex items-center justify-center shadow-inner">
                  <span className="text-white font-bold text-xl leading-none">★</span>
                </div>
                <span className="text-[36px] font-bold tracking-tight">{user.reward_points || '1,250'}</span>
              </div>
            </div>
            <ChevronRight size={24} className="text-white/80" />
          </div>
        </Link>

        {/* Action Grid */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          <Link to="/customer/scan" className="flex flex-col items-center gap-2">
            <div className="w-[68px] h-[68px] bg-[#e8faee] rounded-[22px] flex items-center justify-center text-[#087a4b] active:scale-[0.95] transition-transform">
              <QrCode size={28} strokeWidth={2.5} />
            </div>
            <span className="text-[12px] font-bold text-gray-800 text-center leading-tight mt-1">Scan &<br/>Earn</span>
          </Link>
          <Link to="/customer/rewards" className="flex flex-col items-center gap-2">
            <div className="w-[68px] h-[68px] bg-[#f4ebff] rounded-[22px] flex items-center justify-center text-[#9333ea] active:scale-[0.95] transition-transform">
              <Gift size={28} strokeWidth={2.5} />
            </div>
            <span className="text-[12px] font-bold text-gray-800 text-center leading-tight mt-4">Rewards</span>
          </Link>
          <Link to="/customer/offers" className="flex flex-col items-center gap-2">
            <div className="w-[68px] h-[68px] bg-[#e6f4fe] rounded-[22px] flex items-center justify-center text-[#2563eb] active:scale-[0.95] transition-transform">
              <Tag size={28} strokeWidth={2.5} />
            </div>
            <span className="text-[12px] font-bold text-gray-800 text-center leading-tight mt-4">Offers</span>
          </Link>
          <Link to="/customer/explore" className="flex flex-col items-center gap-2">
            <div className="w-[68px] h-[68px] bg-[#eafbf3] rounded-[22px] flex items-center justify-center text-[#10b981] active:scale-[0.95] transition-transform">
              <MapPin size={28} strokeWidth={2.5} />
            </div>
            <span className="text-[12px] font-bold text-gray-800 text-center leading-tight mt-4">Nearby</span>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="pt-2">
          <div className="flex justify-between items-end mb-5">
            <h3 className="text-[18px] font-bold text-gray-900 tracking-wide">Recent Activity</h3>
            <button className="text-[13px] font-bold text-[#087a4b] hover:underline">View All</button>
          </div>
          <div className="space-y-0 divide-y divide-gray-100">
            <div className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-[50px] h-[50px] bg-[#10b981] text-white rounded-full flex items-center justify-center font-bold text-[10px] leading-tight text-center">
                  FRESH<br/>MART
                </div>
                <div>
                  <p className="font-bold text-[16px] text-gray-900 leading-tight">Fresh Mart</p>
                  <p className="text-[12px] text-gray-400 mt-1">Today, 10:24 AM</p>
                </div>
              </div>
              <p className="font-bold text-[#087a4b] text-[16px]">+25</p>
            </div>
            <div className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-[50px] h-[50px] bg-[#d97706] text-white rounded-full flex items-center justify-center font-bold text-[10px] leading-tight text-center">
                  BAKER'S<br/>HUT
                </div>
                <div>
                  <p className="font-bold text-[16px] text-gray-900 leading-tight">Baker's Hut</p>
                  <p className="text-[12px] text-gray-400 mt-1">Yesterday, 5:12 PM</p>
                </div>
              </div>
              <p className="font-bold text-[#087a4b] text-[16px]">+10</p>
            </div>
            <div className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-[50px] h-[50px] bg-[#0ea5e9] text-white rounded-full flex items-center justify-center font-bold text-[10px] leading-tight text-center">
                  CITY<br/>PHARM
                </div>
                <div>
                  <p className="font-bold text-[16px] text-gray-900 leading-tight">City Pharmacy</p>
                  <p className="text-[12px] text-gray-400 mt-1">Aug 30, 2026</p>
                </div>
              </div>
              <p className="font-bold text-[#087a4b] text-[16px]">+50</p>
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="bg-gradient-to-r from-[#eefaf3] to-[#e6f7ec] rounded-2xl p-5 border border-green-50 flex items-center justify-between shadow-sm relative overflow-hidden mt-2">
          <div className="relative z-10">
            <h3 className="font-bold text-[17px] text-gray-900 leading-tight tracking-wide">More Shopping<br/>More Rewards</h3>
          </div>
          <div className="relative z-10 text-[#facc15] drop-shadow-md">
            <Gift size={48} strokeWidth={2} />
          </div>
        </div>
      </div>
    </div>
  );
}
