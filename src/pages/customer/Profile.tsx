import { UserProfile } from '../../types';
import { Settings, LogOut, ChevronRight, Gift, Clock, Heart, HelpCircle, UserPlus, Shield } from 'lucide-react';

export function CustomerProfile({ user }: { user: UserProfile }) {
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="p-4 pt-12 pb-32 font-sans bg-green-50/30 min-h-screen">
      <div className="flex items-center space-x-4 mb-8 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
        <div className="w-16 h-16 bg-[#0d9254] rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md">
          {getInitials(user.name)}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">{user.name || 'User'}</h2>
          <p className="text-sm text-gray-500 font-medium">{user.phone}</p>
          <button className="text-xs font-bold text-[#0d9254] mt-1">Edit Profile</button>
        </div>
        <button className="p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full">
          <Settings size={20} />
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500"><Gift size={16} /></div>
            <span className="font-bold text-gray-700">My Rewards</span>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </div>
        <div className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500"><Clock size={16} /></div>
            <span className="font-bold text-gray-700">My Transactions</span>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </div>
        <div className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center text-pink-500"><Heart size={16} /></div>
            <span className="font-bold text-gray-700">Favorite Stores</span>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-500"><UserPlus size={16} /></div>
            <span className="font-bold text-gray-700">Refer a Friend</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-[#0d9254] text-white text-[10px] font-bold px-2 py-1 rounded-full">Earn 100 Points</span>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
        </div>
        <div className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500"><HelpCircle size={16} /></div>
            <span className="font-bold text-gray-700">Help & Support</span>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </div>
        <div className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><Shield size={16} /></div>
            <span className="font-bold text-gray-700">Privacy & Terms</span>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </div>
      </div>

      <button className="w-full bg-white rounded-3xl p-4 flex items-center justify-center space-x-2 text-red-500 font-bold hover:bg-red-50 transition-colors shadow-sm border border-gray-100">
        <LogOut size={20} />
        <span>Sign Out</span>
      </button>
    </div>
  );
}
