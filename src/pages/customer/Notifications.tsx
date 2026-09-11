import { Link } from 'react-router-dom';
import { ArrowLeft, Gift, ChevronRight, Trophy, Megaphone, Star } from 'lucide-react';

export function CustomerNotifications() {
  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/home"><ArrowLeft size={24} /></Link>
          <h1 className="text-lg font-bold">Notifications</h1>
        </div>
      </header>

      <div className="px-5 pt-6 pb-6 space-y-6">
        {/* Today Group */}
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 mb-3 px-1">Today</h2>
          <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {/* Notification 1 */}
            <div className="p-4 flex gap-4 items-center hover:bg-gray-50 transition-colors active:scale-[0.99] cursor-pointer">
              <div className="w-12 h-12 bg-green-100 text-[#087a4b] rounded-[16px] flex items-center justify-center flex-shrink-0">
                <Trophy size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">You earned 25 AE Points!</h3>
                <p className="text-[13px] font-semibold text-gray-600 mt-0.5 leading-snug">at Fresh Mart</p>
                <p className="text-[11px] font-medium text-gray-400 mt-1">10:24 AM</p>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </div>

            {/* Notification 2 */}
            <div className="p-4 flex gap-4 items-center hover:bg-gray-50 transition-colors active:scale-[0.99] cursor-pointer">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-[16px] flex items-center justify-center flex-shrink-0">
                <Gift size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">New Offer Nearby!</h3>
                <p className="text-[13px] font-semibold text-gray-600 mt-0.5 leading-snug">Get 2X Points at Spice House</p>
                <p className="text-[11px] font-medium text-gray-400 mt-1">9:15 AM</p>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
          </div>
        </div>

        {/* Yesterday Group */}
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 mb-3 px-1">Yesterday</h2>
          <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {/* Notification 3 */}
            <div className="p-4 flex gap-4 items-center hover:bg-gray-50 transition-colors active:scale-[0.99] cursor-pointer">
              <div className="w-12 h-12 bg-green-100 text-[#087a4b] rounded-[16px] flex items-center justify-center flex-shrink-0">
                <Trophy size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">You earned 10 AE Points!</h3>
                <p className="text-[13px] font-semibold text-gray-600 mt-0.5 leading-snug">at Baker's Hut</p>
                <p className="text-[11px] font-medium text-gray-400 mt-1">5:12 PM</p>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </div>

            {/* Notification 4 */}
            <div className="p-4 flex gap-4 items-center hover:bg-gray-50 transition-colors active:scale-[0.99] cursor-pointer">
              <div className="w-12 h-12 bg-red-100 text-red-500 rounded-[16px] flex items-center justify-center flex-shrink-0">
                <Megaphone size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">Flash Offer!</h3>
                <p className="text-[13px] font-semibold text-gray-600 mt-0.5 leading-snug">Flat 5% off at StyleMart</p>
                <p className="text-[11px] font-medium text-gray-400 mt-1">11:30 AM</p>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
          </div>
        </div>

        {/* This Week Group */}
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 mb-3 px-1">This Week</h2>
          <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {/* Notification 5 */}
            <div className="p-4 flex gap-4 items-center hover:bg-gray-50 transition-colors active:scale-[0.99] cursor-pointer">
              <div className="w-12 h-12 bg-amber-100 text-amber-500 rounded-[16px] flex items-center justify-center flex-shrink-0">
                <Star size={24} className="fill-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">Welcome to AE!</h3>
                <p className="text-[13px] font-semibold text-gray-600 mt-0.5 leading-snug">Here's 50 Bonus Points</p>
                <p className="text-[11px] font-medium text-gray-400 mt-1">Aug 30</p>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
