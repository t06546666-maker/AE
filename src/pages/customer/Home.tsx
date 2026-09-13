import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronRight, Scan, Gift, Tag, MapPin, Star } from 'lucide-react';
import { UserProfile } from '../../types';
import { useCustomerDashboard } from '../../hooks/useCustomerData';

export function CustomerHome({ user }: { user: UserProfile }) {
  const { data, isLoading } = useCustomerDashboard();
  const rewardPoints = data?.reward_points ?? user.reward_points ?? 0;
  const activity = data?.activity ?? [];

  const getInitials = (name?: string) => {
    if (!name) return 'AE';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (index: number) => {
    const colors = ['bg-[#22c55e]', 'bg-[#d97706]', 'bg-[#0ea5e9]', 'bg-[#c026d3]', 'bg-[#f43f5e]'];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-white min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-4 py-4 bg-white sticky top-0 z-10">
        <div className="w-6" />
        <img src="/logo.png" alt="Affiliate AE" className="absolute left-1/2 -translate-x-1/2 object-contain" style={{ width: 72, height: 40 }} />
        <Link to="/customer/notifications" className="relative text-gray-800">
          <Bell size={24} />
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-[1.5px] border-white"></span>
        </Link>
      </header>

      <div className="px-4 pt-2 space-y-6">
        {/* Greeting */}
        <div>
          <h2 className="text-[20px] font-bold text-gray-900 mb-0.5 flex items-center gap-1">
            Hi, {user.name?.split(' ')[0] || user.phone || 'User'}! <span className="text-[20px]">👋</span>
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
                <span className="text-[32px] font-bold tracking-tight">{isLoading ? '...' : rewardPoints}</span>
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
            <Link to="/customer/transactions" className="text-[12px] font-bold text-[#22c55e]">View All</Link>
          </div>
          <div className="space-y-0 divide-y divide-gray-100 border-t border-gray-100">
            {isLoading ? (
              <div className="py-8 text-center text-gray-400 text-sm">Loading activity...</div>
            ) : activity.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">No recent activity</div>
            ) : (
              activity.map((item, idx) => (
                <div key={item.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-[42px] h-[42px] ${getAvatarColor(idx)} text-white rounded-full flex items-center justify-center font-bold text-[10px] leading-tight text-center`}>
                      {getInitials(item.merchant_name)}
                    </div>
                    <div>
                      <p className="font-bold text-[14px] text-gray-900 leading-tight">{item.merchant_name || 'Store'}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold text-[14px] ${item.type === 'earn' ? 'text-[#22c55e]' : 'text-gray-900'}`}>
                    {item.type === 'earn' ? '+' : '-'}{item.points}
                  </p>
                </div>
              ))
            )}
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
