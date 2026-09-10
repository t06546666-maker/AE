import { Link } from 'react-router-dom';
import { ArrowLeft, Gift, Tag, CheckCircle2, Star } from 'lucide-react';

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
          <h2 className="text-[14px] font-bold text-gray-500 mb-3 px-1 uppercase tracking-wider">Today</h2>
          <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {/* Notification 1 */}
            <div className="p-4 flex gap-4 bg-green-50/30">
              <div className="w-10 h-10 bg-[#087a4b] text-white rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                <Star size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">Fresh Mart points added!</h3>
                <p className="text-[13px] text-gray-600 mt-1 leading-snug">You earned 25 points from your recent purchase at Fresh Mart.</p>
                <p className="text-[11px] font-medium text-[#087a4b] mt-2">10:24 AM</p>
              </div>
            </div>

            {/* Notification 2 */}
            <div className="p-4 flex gap-4">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Tag size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">New Offer Available!</h3>
                <p className="text-[13px] text-gray-600 mt-1 leading-snug">20% off your next purchase at Fresh Mart. Valid until Sep 30.</p>
                <p className="text-[11px] font-medium text-gray-400 mt-2">09:15 AM</p>
              </div>
            </div>
          </div>
        </div>

        {/* Yesterday Group */}
        <div>
          <h2 className="text-[14px] font-bold text-gray-500 mb-3 px-1 uppercase tracking-wider">Yesterday</h2>
          <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {/* Notification 3 */}
            <div className="p-4 flex gap-4">
              <div className="w-10 h-10 bg-[#087a4b] text-white rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Star size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">Baker's Hut points added!</h3>
                <p className="text-[13px] text-gray-600 mt-1 leading-snug">You earned 10 points from your purchase at Baker's Hut.</p>
                <p className="text-[11px] font-medium text-gray-400 mt-2">5:12 PM</p>
              </div>
            </div>

            {/* Notification 4 */}
            <div className="p-4 flex gap-4">
              <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">Account updated!</h3>
                <p className="text-[13px] text-gray-600 mt-1 leading-snug">Your profile information has been successfully updated.</p>
                <p className="text-[11px] font-medium text-gray-400 mt-2">2:30 PM</p>
              </div>
            </div>
            
            {/* Notification 5 */}
            <div className="p-4 flex gap-4">
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Gift size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">Welcome to Affiliate AE!</h3>
                <p className="text-[13px] text-gray-600 mt-1 leading-snug">Here is 50 welcome points to get you started. Happy shopping!</p>
                <p className="text-[11px] font-medium text-gray-400 mt-2">Yesterday</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
