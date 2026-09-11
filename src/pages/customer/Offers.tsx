import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useCustomerOffers } from '../../hooks/useCustomerData';

const CATEGORIES = ['All', 'Nearby', 'Trending', 'Favorites'];

export function CustomerOffers() {
  const [activeCategory, setActiveCategory] = useState('All');
  const { data, isLoading } = useCustomerOffers();
  const offers = data?.offers ?? [];

  // When API provides category data, filter here. For now all categories show same list.
  const filtered = offers.filter(() => true);

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/home"><ArrowLeft size={24} /></Link>
          <h1 className="text-lg font-bold">Offers</h1>
        </div>
      </header>

      {/* Categories */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide -mx-5 px-5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                activeCategory === cat
                  ? 'bg-[#087a4b] text-white shadow-md shadow-green-600/20'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-2 space-y-4">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Loading offers...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No active offers{activeCategory !== 'All' ? ` in "${activeCategory}"` : ''}.</div>
        ) : (
          filtered.map((offer) => (
            <div key={offer.id} className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden flex active:scale-[0.98] transition-transform p-3">
              <div className="w-[100px] h-[100px] bg-gray-100 rounded-[16px] flex-shrink-0 flex items-center justify-center overflow-hidden">
                {offer.imageUrl ? (
                  <img src={offer.imageUrl} alt={offer.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-16 h-16 bg-gray-300 rounded-full"></div>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col justify-center relative">
                <h3 className="font-bold text-[15px] text-gray-900 leading-tight">{offer.title}</h3>
                <p className="font-bold text-[14px] text-[#e11d48] mt-1 leading-tight line-clamp-2">{offer.description}</p>
                <p className="font-semibold text-[13px] text-gray-700 leading-tight mt-1">at {offer.merchant_name || 'Store'}</p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[11px] font-medium text-gray-500">
                    Valid till {new Date(offer.expires_at).toLocaleDateString()}
                  </p>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
