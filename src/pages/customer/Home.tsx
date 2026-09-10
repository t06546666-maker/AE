import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronRight, QrCode, Gift, Tag, MapPin, Activity, Star } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerHome({ user }: { user: UserProfile }) {
  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px] md:pb-8">
      {/* Mobile Header (Hidden on Desktop) */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 md:hidden shadow-sm">
        <ArrowLeft size={24} className="text-gray-800" />
        <h1 className="text-2xl font-black tracking-tighter absolute left-1/2 transform -translate-x-1/2 text-[#087a4b]">AE</h1>
        <Link to="/customer/notifications" className="relative text-gray-800">
          <Bell size={24} />
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-4 md:pt-8">
        {/* Desktop Header / Greeting */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-[22px] md:text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              Hi, {user.name?.split(' ')[0] || user.phone || 'Sharon'}! <span className="text-2xl md:text-3xl">👋</span>
            </h2>
            <p className="text-[14px] md:text-base text-gray-500 font-medium tracking-wide">Shop Local. Earn More.</p>
          </div>
          <div className="hidden md:flex gap-3">
            <Link to="/customer/notifications" className="p-3 bg-white border border-gray-200 rounded-full text-gray-600 hover:text-[#087a4b] hover:border-[#087a4b] transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
          {/* Main Content Area (Left on Desktop) */}
          <div className="md:col-span-8 space-y-6 md:space-y-8">
            
            {/* Desktop Hero / Points Card */}
            <Link to="/customer/transactions" className="block bg-[#087a4b] rounded-[24px] md:rounded-[32px] p-6 md:p-10 text-white shadow-[0_8px_20px_rgba(8,122,75,0.25)] relative overflow-hidden active:scale-[0.98] transition-transform group">
              <div className="absolute -right-10 -top-10 w-40 h-40 md:w-64 md:h-64 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
              <div className="absolute -left-10 -bottom-10 w-32 h-32 md:w-48 md:h-48 bg-black/10 rounded-full blur-2xl"></div>
              
              <div className="flex flex-col md:flex-row justify-between md:items-center relative z-10 gap-6">
                <div>
                  <p className="text-[14px] md:text-lg font-medium text-green-50 mb-2 md:mb-4">Your Available AE Points</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 md:w-14 md:h-14 bg-[#f59e0b] rounded-full flex items-center justify-center shadow-inner">
                      <Star className="text-white fill-white" size={20} />
                    </div>
                    <span className="text-[36px] md:text-5xl font-bold tracking-tight">{user.reward_points || '1,250'}</span>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2 bg-white/20 px-5 py-3 rounded-full backdrop-blur-sm">
                  <span className="font-semibold tracking-wide">View History</span>
                  <ChevronRight size={20} />
                </div>
                <ChevronRight size={24} className="text-white/80 md:hidden absolute right-0 top-1/2 -translate-y-1/2" />
              </div>
            </Link>

            {/* Quick Actions (Grid of 4) */}
            <div className="grid grid-cols-4 gap-3 md:gap-6 pt-1 md:pt-0">
              <Link to="/customer/scan" className="flex flex-col items-center gap-2 md:gap-4 p-2 md:p-6 bg-white rounded-[24px] md:rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                <div className="w-[60px] h-[60px] md:w-[80px] md:h-[80px] bg-[#e8faee] rounded-[20px] md:rounded-2xl flex items-center justify-center text-[#087a4b] group-hover:scale-110 transition-transform">
                  <QrCode size={28} className="md:w-9 md:h-9" strokeWidth={2.5} />
                </div>
                <span className="text-[12px] md:text-[15px] font-bold text-gray-800 text-center leading-tight">Scan &<br className="md:hidden"/> Earn</span>
              </Link>
              <Link to="/customer/rewards" className="flex flex-col items-center gap-2 md:gap-4 p-2 md:p-6 bg-white rounded-[24px] md:rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                <div className="w-[60px] h-[60px] md:w-[80px] md:h-[80px] bg-[#f4ebff] rounded-[20px] md:rounded-2xl flex items-center justify-center text-[#9333ea] group-hover:scale-110 transition-transform">
                  <Gift size={28} className="md:w-9 md:h-9" strokeWidth={2.5} />
                </div>
                <span className="text-[12px] md:text-[15px] font-bold text-gray-800 text-center leading-tight">Rewards<br className="md:hidden"/>&nbsp;</span>
              </Link>
              <Link to="/customer/offers" className="flex flex-col items-center gap-2 md:gap-4 p-2 md:p-6 bg-white rounded-[24px] md:rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                <div className="w-[60px] h-[60px] md:w-[80px] md:h-[80px] bg-[#e6f4fe] rounded-[20px] md:rounded-2xl flex items-center justify-center text-[#2563eb] group-hover:scale-110 transition-transform">
                  <Tag size={28} className="md:w-9 md:h-9" strokeWidth={2.5} />
                </div>
                <span className="text-[12px] md:text-[15px] font-bold text-gray-800 text-center leading-tight">Offers<br className="md:hidden"/>&nbsp;</span>
              </Link>
              <Link to="/customer/explore" className="flex flex-col items-center gap-2 md:gap-4 p-2 md:p-6 bg-white rounded-[24px] md:rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                <div className="w-[60px] h-[60px] md:w-[80px] md:h-[80px] bg-[#eafbf3] rounded-[20px] md:rounded-2xl flex items-center justify-center text-[#10b981] group-hover:scale-110 transition-transform">
                  <MapPin size={28} className="md:w-9 md:h-9" strokeWidth={2.5} />
                </div>
                <span className="text-[12px] md:text-[15px] font-bold text-gray-800 text-center leading-tight">Nearby<br className="md:hidden"/>&nbsp;</span>
              </Link>
            </div>

            {/* Banner */}
            <div className="bg-gradient-to-r from-[#087a4b] to-[#0d945d] rounded-2xl md:rounded-3xl p-6 md:p-8 flex items-center justify-between shadow-lg relative overflow-hidden mt-4">
              <div className="absolute right-0 top-0 w-64 h-full bg-white/10 skew-x-12 transform translate-x-10"></div>
              <div className="relative z-10 text-white">
                <h3 className="font-black text-[18px] md:text-2xl leading-tight tracking-wide mb-1 md:mb-2">More Shopping,<br/>More Rewards!</h3>
                <p className="text-green-100 text-[13px] md:text-base font-medium">Discover new merchants today.</p>
              </div>
              <div className="relative z-10 text-[#facc15] drop-shadow-[0_4px_12px_rgba(250,204,21,0.5)]">
                <Gift size={56} className="md:w-20 md:h-20" strokeWidth={1.5} />
              </div>
            </div>

          </div>

          {/* Sidebar Area (Right on Desktop) */}
          <div className="md:col-span-4 mt-6 md:mt-0">
            <div className="bg-white rounded-[24px] md:rounded-3xl p-5 md:p-7 shadow-sm border border-gray-100 h-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[18px] md:text-[20px] font-bold text-gray-900 tracking-wide flex items-center gap-2">
                  <Activity size={20} className="text-[#087a4b]" /> Recent Activity
                </h3>
                <button className="text-[13px] md:text-[14px] font-bold text-[#087a4b] hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors">View All</button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-[48px] h-[48px] bg-gradient-to-br from-[#10b981] to-[#059669] text-white rounded-full flex items-center justify-center font-bold text-[10px] leading-tight text-center shadow-sm">
                      FRESH<br/>MART
                    </div>
                    <div>
                      <p className="font-bold text-[15px] text-gray-900 leading-tight">Fresh Mart</p>
                      <p className="text-[12px] text-gray-500 mt-1 font-medium">Today, 10:24 AM</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#087a4b] text-[16px] md:text-[18px]">+25</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Points</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-[48px] h-[48px] bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white rounded-full flex items-center justify-center font-bold text-[10px] leading-tight text-center shadow-sm">
                      BAKER'S<br/>HUT
                    </div>
                    <div>
                      <p className="font-bold text-[15px] text-gray-900 leading-tight">Baker's Hut</p>
                      <p className="text-[12px] text-gray-500 mt-1 font-medium">Yesterday, 5:12 PM</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#087a4b] text-[16px] md:text-[18px]">+10</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Points</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-[48px] h-[48px] bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white rounded-full flex items-center justify-center font-bold text-[10px] leading-tight text-center shadow-sm">
                      CITY<br/>PHARM
                    </div>
                    <div>
                      <p className="font-bold text-[15px] text-gray-900 leading-tight">City Pharmacy</p>
                      <p className="text-[12px] text-gray-500 mt-1 font-medium">Aug 30, 2026</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#087a4b] text-[16px] md:text-[18px]">+50</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Points</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
