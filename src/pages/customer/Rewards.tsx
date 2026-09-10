import { Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerRewards({ user }: { user: UserProfile }) {
  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/home"><ArrowLeft size={24} /></Link>
          <h1 className="text-lg font-bold">Rewards</h1>
        </div>
        <button className="text-gray-800">
          <Search size={24} />
        </button>
      </header>
      
      {/* Categories */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide -mx-5 px-5">
          {['All', 'Food & Beverage', 'Retail', 'Health'].map((cat, i) => (
            <button 
              key={cat}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                i === 0 ? 'bg-[#087a4b] text-white shadow-md shadow-green-600/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-3 pt-2">
        {/* Item 1 */}
        <div className="bg-white rounded-[20px] p-3 flex gap-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
          <div className="w-[88px] h-[88px] bg-amber-50 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden">
             {/* Placeholder for Coffee Image */}
             <div className="w-12 h-12 bg-amber-200 rounded-full"></div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h3 className="font-bold text-[15px] text-gray-900 leading-tight">Free Regular Coffee</h3>
            <p className="text-[12px] text-gray-500 mt-1 mb-2">Café Corner</p>
            <div className="flex justify-between items-center mt-auto">
              <p className="text-[12px] font-bold text-[#087a4b] flex items-center gap-1">
                <div className="w-4 h-4 bg-[#f59e0b] rounded-full flex items-center justify-center">
                  <span className="text-white text-[10px] leading-none">★</span>
                </div> 500 Points
              </p>
              <button className="bg-[#087a4b] text-white px-4 py-1.5 rounded-full text-[11px] font-bold hover:bg-[#0a7a46] transition-colors shadow-sm">
                Redeem
              </button>
            </div>
          </div>
        </div>

        {/* Item 2 */}
        <div className="bg-white rounded-[20px] p-3 flex gap-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
          <div className="w-[88px] h-[88px] bg-orange-50 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden">
             {/* Placeholder for Food Image */}
             <div className="w-14 h-14 bg-orange-200 rounded-full"></div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h3 className="font-bold text-[15px] text-gray-900 leading-tight">₹100 Off<br/><span className="text-[13px] font-semibold text-gray-600">on ₹500</span></h3>
            <p className="text-[12px] text-gray-500 mt-1 mb-2">Spice House</p>
            <div className="flex justify-between items-center mt-auto">
              <p className="text-[12px] font-bold text-[#087a4b] flex items-center gap-1">
                <div className="w-4 h-4 bg-[#f59e0b] rounded-full flex items-center justify-center">
                  <span className="text-white text-[10px] leading-none">★</span>
                </div> 1,000 Points
              </p>
              <button className="bg-[#087a4b] text-white px-4 py-1.5 rounded-full text-[11px] font-bold hover:bg-[#0a7a46] transition-colors shadow-sm">
                Redeem
              </button>
            </div>
          </div>
        </div>

        {/* Item 3 */}
        <div className="bg-white rounded-[20px] p-3 flex gap-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
          <div className="w-[88px] h-[88px] bg-blue-50 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden">
             {/* Placeholder for Retail Image */}
             <div className="w-10 h-14 bg-blue-200 rounded-sm"></div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h3 className="font-bold text-[15px] text-gray-900 leading-tight">5% Off<br/><span className="text-[13px] font-semibold text-gray-600">on all products</span></h3>
            <p className="text-[12px] text-gray-500 mt-1 mb-2">StyleMart</p>
            <div className="flex justify-between items-center mt-auto">
              <p className="text-[12px] font-bold text-[#087a4b] flex items-center gap-1">
                <div className="w-4 h-4 bg-[#f59e0b] rounded-full flex items-center justify-center">
                  <span className="text-white text-[10px] leading-none">★</span>
                </div> 750 Points
              </p>
              <button className="bg-[#087a4b] text-white px-4 py-1.5 rounded-full text-[11px] font-bold hover:bg-[#0a7a46] transition-colors shadow-sm">
                Redeem
              </button>
            </div>
          </div>
        </div>

        {/* Item 4 */}
        <div className="bg-white rounded-[20px] p-3 flex gap-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
          <div className="w-[88px] h-[88px] bg-cyan-50 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden">
             {/* Placeholder for Health Image */}
             <div className="w-10 h-10 bg-cyan-200 rounded-sm"></div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h3 className="font-bold text-[15px] text-gray-900 leading-tight">10% Off<br/><span className="text-[13px] font-semibold text-gray-600">on medicines</span></h3>
            <p className="text-[12px] text-gray-500 mt-1 mb-2">City Pharmacy</p>
            <div className="flex justify-between items-center mt-auto">
              <p className="text-[12px] font-bold text-[#087a4b] flex items-center gap-1">
                <div className="w-4 h-4 bg-[#f59e0b] rounded-full flex items-center justify-center">
                  <span className="text-white text-[10px] leading-none">★</span>
                </div> 800 Points
              </p>
              <button className="bg-[#087a4b] text-white px-4 py-1.5 rounded-full text-[11px] font-bold hover:bg-[#0a7a46] transition-colors shadow-sm">
                Redeem
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
