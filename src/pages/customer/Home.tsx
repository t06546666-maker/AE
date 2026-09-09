import { UserProfile } from '../../types';

export function CustomerHome({ user }: { user: UserProfile }) {
  return (
    <div className="p-4 space-y-6 pt-8 pb-32">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Hi, {user.name?.split(' ')[0] || 'User'}! 👋</h2>
          <p className="text-sm text-gray-500 font-medium">Shop Local. Earn More.</p>
        </div>
      </header>

      <div className="bg-gradient-to-r from-[#0d9254] to-[#0a7a46] rounded-3xl p-6 text-white shadow-[0_8px_30px_rgba(13,146,84,0.3)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
        <p className="text-sm font-medium text-green-50 mb-1 relative z-10">Your AE Points</p>
        <div className="flex items-center space-x-3 relative z-10">
          <div className="bg-[#ffd263] w-10 h-10 rounded-full flex items-center justify-center shadow-inner">
            <span className="text-amber-700 font-bold text-xl">★</span>
          </div>
          <span className="text-4xl font-black tracking-tight">{user.rewardPoints || 0}</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
          <button className="text-sm font-bold text-[#0d9254] hover:text-[#0a7a46]">View All</button>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-bold">
                  {i}
                </div>
                <div>
                  <p className="font-bold text-gray-900">Store Name</p>
                  <p className="text-xs text-gray-500 font-medium">Today, 10:24 AM</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#0d9254]">+25</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
