import { Link } from 'react-router-dom';
import { ArrowLeft, Tag, ShoppingBag, Truck } from 'lucide-react';

export function CustomerOffers() {
  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/home"><ArrowLeft size={24} /></Link>
          <h1 className="text-lg font-bold">Offers</h1>
        </div>
      </header>

      <div className="px-5 pt-6 space-y-4">
        {/* Offer 1 */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform">
          <div className="h-32 bg-[#087a4b] relative flex items-center justify-center overflow-hidden">
             <div className="absolute inset-0 bg-white/10" style={{ backgroundImage: 'radial-gradient(circle, transparent 20%, #087a4b 20%, #087a4b 80%, transparent 80%, transparent)' }}></div>
             <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
             <div className="absolute -left-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
             <h2 className="text-white text-4xl font-black italic tracking-tighter drop-shadow-md z-10">20% OFF</h2>
          </div>
          <div className="p-4 flex gap-4 items-center">
             <div className="w-12 h-12 bg-green-50 text-[#087a4b] rounded-full flex items-center justify-center flex-shrink-0">
               <Tag size={24} />
             </div>
             <div>
               <h3 className="font-bold text-[16px] text-gray-900 leading-tight">Summer Sale 20% Off<br/>at Fresh Mart</h3>
               <p className="text-[12px] font-medium text-gray-500 mt-1">Valid until Sep 30</p>
             </div>
          </div>
        </div>

        {/* Offer 2 */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform">
          <div className="h-32 bg-[#f59e0b] relative flex items-center justify-center overflow-hidden">
             <div className="absolute inset-0 bg-white/10" style={{ backgroundImage: 'radial-gradient(circle, transparent 20%, #f59e0b 20%, #f59e0b 80%, transparent 80%, transparent)' }}></div>
             <div className="absolute right-0 bottom-0 w-32 h-32 bg-white/20 rounded-tl-full"></div>
             <h2 className="text-white text-3xl font-black tracking-tight drop-shadow-md z-10 text-center leading-none">BUY 1<br/>GET 1</h2>
          </div>
          <div className="p-4 flex gap-4 items-center">
             <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
               <ShoppingBag size={24} />
             </div>
             <div>
               <h3 className="font-bold text-[16px] text-gray-900 leading-tight">Free Coffee<br/>at Café Corner</h3>
               <p className="text-[12px] font-medium text-gray-500 mt-1">Valid until Oct 15</p>
             </div>
          </div>
        </div>

        {/* Offer 3 */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform">
          <div className="h-32 bg-[#3b82f6] relative flex items-center justify-center overflow-hidden">
             <div className="absolute inset-0 bg-white/10" style={{ backgroundImage: 'radial-gradient(circle, transparent 20%, #3b82f6 20%, #3b82f6 80%, transparent 80%, transparent)' }}></div>
             <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-24 h-24 bg-white/20 rounded-full"></div>
             <div className="absolute -right-10 top-1/2 -translate-y-1/2 w-24 h-24 bg-white/20 rounded-full"></div>
             <h2 className="text-white text-3xl font-black tracking-tight drop-shadow-md z-10 text-center leading-none">FREE<br/>DELIVERY</h2>
          </div>
          <div className="p-4 flex gap-4 items-center">
             <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
               <Truck size={24} />
             </div>
             <div>
               <h3 className="font-bold text-[16px] text-gray-900 leading-tight">Free Delivery from<br/>City Pharmacy</h3>
               <p className="text-[12px] font-medium text-gray-500 mt-1">Min. order ₹500</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
