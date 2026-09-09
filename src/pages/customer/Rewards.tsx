import { UserProfile } from '../../types';

export function CustomerRewards({ user }: { user: UserProfile }) {
  return (
    <div className="p-4 pt-8 pb-32 font-sans bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Rewards</h2>
      
      {/* Categories */}
      <div className="flex overflow-x-auto space-x-2 pb-4 mb-2 -mx-4 px-4 scrollbar-hide">
        {['All', 'Food & Beverage', 'Retail', 'Health'].map((cat, i) => (
          <button 
            key={cat}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition-colors ${
              i === 0 ? 'bg-[#0d9254] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-white rounded-3xl p-4 flex gap-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-24 h-24 bg-gray-100 rounded-2xl flex-shrink-0 object-cover" />
            <div className="flex-1 flex flex-col justify-center">
              <h3 className="font-bold text-gray-900 leading-tight">Free Regular Coffee</h3>
              <p className="text-sm text-gray-500 mb-2">Café Corner</p>
              <div className="flex justify-between items-center mt-auto">
                <p className="text-sm font-bold text-[#0d9254] flex items-center">
                  <span className="text-amber-500 mr-1">★</span> 500 Points
                </p>
                <button className="bg-[#0d9254] text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-[#0a7a46] transition-colors">
                  Redeem
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
