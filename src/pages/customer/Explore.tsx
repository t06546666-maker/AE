import { Link } from 'react-router-dom';
import { ArrowLeft, Search, MapPin as MapPinIcon, ChevronRight } from 'lucide-react';

export function CustomerExplore() {
  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/home"><ArrowLeft size={24} /></Link>
          <h1 className="text-lg font-bold">Nearby Merchants</h1>
        </div>
        <button className="text-gray-800">
          <Search size={24} />
        </button>
      </header>

      {/* Categories */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide -mx-5 px-5">
          {['All', 'Food', 'Retail', 'Health', 'More'].map((cat, i) => (
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

      {/* Map Area */}
      <div className="px-5 mb-6">
        <div className="bg-gray-100 rounded-3xl h-56 relative overflow-hidden shadow-inner border border-gray-200">
           {/* Map Grid Pattern (Placeholder) */}
           <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#087a4b 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
           
           {/* You Marker */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-4 border-white shadow-md">
             <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-50"></div>
           </div>

           {/* Merchant Markers */}
           <MapPinIcon size={28} className="absolute top-10 left-10 text-[#087a4b] fill-white" />
           <MapPinIcon size={28} className="absolute top-12 right-20 text-[#087a4b] fill-white" />
           <MapPinIcon size={28} className="absolute bottom-12 right-12 text-[#087a4b] fill-white" />
           <MapPinIcon size={28} className="absolute bottom-8 left-20 text-[#087a4b] fill-white" />
        </div>
      </div>

      {/* Merchant List */}
      <div className="px-5 space-y-3">
        {/* Item 1 */}
        <div className="bg-white rounded-[20px] p-4 flex items-center justify-between shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">
              FRESH
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-gray-900 leading-tight">Fresh Mart</h3>
              <p className="text-[12px] font-bold text-[#087a4b] mt-1">2% AE Points</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="text-[12px] font-medium text-gray-500">0.3 km</p>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
        </div>

        {/* Item 2 */}
        <div className="bg-white rounded-[20px] p-4 flex items-center justify-between shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold text-xs">
              BAKER
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-gray-900 leading-tight">Baker's Hut</h3>
              <p className="text-[12px] font-bold text-[#087a4b] mt-1">1.5% AE Points</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="text-[12px] font-medium text-gray-500">0.5 km</p>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
        </div>

        {/* Item 3 */}
        <div className="bg-white rounded-[20px] p-4 flex items-center justify-between shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">
              CITY
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-gray-900 leading-tight">City Pharmacy</h3>
              <p className="text-[12px] font-bold text-[#087a4b] mt-1">2% AE Points</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="text-[12px] font-medium text-gray-500">0.7 km</p>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
