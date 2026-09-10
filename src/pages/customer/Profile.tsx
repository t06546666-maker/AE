import { Link } from 'react-router-dom';
import { Settings, LogOut, ChevronRight, Gift, Clock, Heart, HelpCircle, UserPlus, Shield, ArrowLeft, Star } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerProfile({ user, onLogout }: { user: UserProfile; onLogout: () => void }) {
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px] flex flex-col relative">
      {/* Top Green Section */}
      <div className="bg-[#e9f8f0] pb-10 pt-4 px-5 rounded-b-[40px] shadow-sm relative z-10">
        <header className="flex justify-between items-center mb-6">
          <Link to="/customer/home" className="text-gray-800"><ArrowLeft size={24} /></Link>
          <button className="text-gray-800"><Settings size={24} /></button>
        </header>

        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-[#087a4b] rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4">
            {getInitials(user.name)}
          </div>
          <h2 className="text-[20px] font-bold text-gray-900 leading-tight">{user.name || 'User'}</h2>
          <p className="text-[14px] text-[#087a4b] font-semibold mt-1">{user.phone}</p>
          <button className="text-[12px] font-bold text-gray-500 mt-2 hover:text-[#087a4b] transition-colors">Edit Profile</button>
        </div>
      </div>

      <div className="px-5 -mt-6 relative z-20 space-y-4">
        {/* Section 1 */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          <Link to="/customer/profile" className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Star size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">My Points</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
          <Link to="/customer/rewards" className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Gift size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">My Rewards</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
          <Link to="/customer/profile" className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Clock size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">My Transactions</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
          <Link to="/customer/explore" className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Heart size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">My Favorite Stores</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
        </div>

        {/* Section 2 */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          <button className="w-full p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <UserPlus size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">Refer a Friend</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-[#087a4b] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">Earn 100 Points</span>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
          </button>
          <button className="w-full p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <HelpCircle size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">Help & Support</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
          <button className="w-full p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Settings size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">App Settings</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
          <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Shield size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">Privacy & Terms</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Section 3 */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          <button onClick={onLogout} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <LogOut size={20} className="text-gray-800" />
              <span className="font-semibold text-[15px] text-gray-800">Sign Out</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
