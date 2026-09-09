import { Search } from 'lucide-react';

export function CustomerExplore() {
  return (
    <div className="p-4 pt-8 pb-32 font-sans bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Nearby Merchants</h2>
      
      <div className="relative mb-6">
        <input 
          type="text" 
          placeholder="Search stores..." 
          className="w-full pl-10 pr-4 py-3 rounded-2xl border-none shadow-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#0d9254]"
        />
        <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
      </div>

      <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100 h-48 mb-6 flex items-center justify-center relative overflow-hidden">
        {/* Placeholder Map */}
        <div className="absolute inset-0 bg-[#e8f5fb] opacity-50"></div>
        <div className="w-12 h-12 bg-[#0d9254] text-white rounded-full flex items-center justify-center font-bold absolute shadow-lg border-2 border-white transform hover:scale-110 cursor-pointer z-10 animate-bounce">
          You
        </div>
        
        {/* Merchant pins */}
        <div className="w-8 h-8 bg-white text-[#0d9254] rounded-full flex items-center justify-center font-bold absolute top-10 left-10 shadow border-2 border-[#0d9254]">★</div>
        <div className="w-8 h-8 bg-white text-[#0d9254] rounded-full flex items-center justify-center font-bold absolute bottom-12 right-16 shadow border-2 border-[#0d9254]">★</div>
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-white rounded-3xl p-4 flex items-center justify-between shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">M</div>
              <div>
                <h3 className="font-bold text-gray-900">Merchant Name</h3>
                <p className="text-xs font-bold text-[#0d9254]">2% AE Points</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-500">0.3 km</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
