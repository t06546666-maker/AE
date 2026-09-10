import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, QrCode, Gift, User, MapPin } from 'lucide-react';
import { UserProfile } from '../types';

export function CustomerLayout({ user, onLogout, children }: { user: UserProfile; onLogout?: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans relative overflow-hidden w-full">
      <main className="flex-1 overflow-y-auto pb-[80px] w-full h-full">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-[72px] pb-safe z-50 rounded-t-2xl shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        <NavLink to="/customer/home" className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full space-y-1 pt-1 ${isActive ? 'text-[#0d9254]' : 'text-gray-400 hover:text-gray-600'}`}>
          <Home size={22} strokeWidth={2.5} />
          <span className="text-[10px] font-semibold tracking-wide">Home</span>
        </NavLink>
        <NavLink to="/customer/explore" className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full space-y-1 pt-1 ${isActive ? 'text-[#0d9254]' : 'text-gray-400 hover:text-gray-600'}`}>
          <MapPin size={22} strokeWidth={2.5} />
          <span className="text-[10px] font-semibold tracking-wide">Explore</span>
        </NavLink>
        <div className="flex flex-col items-center justify-center w-full h-full -mt-6">
          <NavLink to="/customer/scan" className="bg-[#0d9254] text-white rounded-full p-[14px] shadow-lg shadow-green-600/30 hover:bg-[#0a7a46] transition-all transform hover:scale-105 active:scale-95">
            <QrCode size={26} strokeWidth={2} />
          </NavLink>
        </div>
        <NavLink to="/customer/rewards" className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full space-y-1 pt-1 ${isActive ? 'text-[#0d9254]' : 'text-gray-400 hover:text-gray-600'}`}>
          <Gift size={22} strokeWidth={2.5} />
          <span className="text-[10px] font-semibold tracking-wide">Rewards</span>
        </NavLink>
        <NavLink to="/customer/profile" className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full space-y-1 pt-1 ${isActive ? 'text-[#0d9254]' : 'text-gray-400 hover:text-gray-600'}`}>
          <User size={22} strokeWidth={2.5} />
          <span className="text-[10px] font-semibold tracking-wide">Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}
