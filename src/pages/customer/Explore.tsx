import { Link } from 'react-router-dom';
import { ArrowLeft, Search, ChevronRight, X } from 'lucide-react';
import { useCustomerMerchants, useCustomerCategories } from '../../hooks/useCustomerData';
import { useState } from 'react';
import { CustomerNearbyMap } from '../../components/CustomerNearbyMap';



export function CustomerExplore() {
  const [page, setPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMerchantId, setSelectedMerchantId] = useState('');

  const categoriesQuery = useCustomerCategories();
  const { data, isLoading } = useCustomerMerchants(page, search, selectedCategory);
  const merchants = data?.merchants ?? [];

  const getInitials = (name?: string) => {
    if (!name) return 'AE';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (index: number) => {
    const colors = ['bg-green-100 text-green-700', 'bg-amber-100 text-amber-700', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700'];
    return colors[index % colors.length];
  };

  const handleSearchToggle = () => {
    if (searchOpen) {
      setSearchOpen(false);
      setInputValue('');
      setSearch('');
      setPage(1);
    } else {
      setSearchOpen(true);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputValue);
    setPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    // Pass category as search hint when not 'All'
    if (cat !== 'All') {
      setSearch(cat);
    } else {
      setSearch(inputValue);
    }
    setPage(1);
  };

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px]">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/home"><ArrowLeft size={24} /></Link>
          <h1 className="text-lg font-bold">Nearby Merchants</h1>
        </div>
        <button onClick={handleSearchToggle} className="text-gray-800">
          {searchOpen ? <X size={24} /> : <Search size={24} />}
        </button>
      </header>

      {/* Search Bar */}
      {searchOpen && (
        <form onSubmit={handleSearchSubmit} className="px-5 pt-3 pb-1 bg-white border-b border-gray-100">
          <input
            autoFocus
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onBlur={() => { setSearch(inputValue); setPage(1); }}
            placeholder="Search merchants..."
            className="w-full bg-gray-50 border border-gray-200 rounded-[12px] px-4 py-2.5 text-[14px] font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#087a4b] focus:ring-1 focus:ring-[#087a4b] transition-all"
          />
        </form>
      )}

      {/* Categories */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide -mx-5 px-5">
          <button
            onClick={() => handleCategoryChange('All')}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
              activeCategory === 'All'
                ? 'bg-[#087a4b] text-white shadow-md shadow-green-600/20'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {categoriesQuery.data?.categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                activeCategory === cat.id
                  ? 'bg-[#087a4b] text-white shadow-md shadow-green-600/20'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <CustomerNearbyMap merchants={merchants} selectedMerchantId={selectedMerchantId} />

      {/* Merchant List */}
      <div className="px-5 space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Loading merchants...</div>
        ) : merchants.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No merchants found{search ? ` for "${search}"` : ''}.</div>
        ) : (
          merchants.map((merchant, idx) => (
            <button
              key={merchant.id}
              onClick={() => setSelectedMerchantId(merchant.id)}
              className="w-full bg-white rounded-[20px] p-4 flex items-center justify-between shadow-sm border border-gray-100 active:scale-[0.98] transition-transform text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${getAvatarColor(idx)} rounded-full flex items-center justify-center font-bold text-xs`}>
                  {getInitials(merchant.merchant_name)}
                </div>
                <div>
                  <h3 className="font-bold text-[15px] text-gray-900 leading-tight">{merchant.merchant_name}</h3>
                  {merchant.category && <p className="text-[11px] text-gray-500 font-medium mt-0.5">{merchant.category}</p>}
                  <p className="text-[12px] font-bold text-[#087a4b] mt-1">Accepts AE Points</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-[12px] font-medium text-gray-500">Nearby</p>
                <ChevronRight size={18} className="text-gray-400" />
              </div>
            </button>
          ))
        )}
      </div>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex justify-between items-center pt-4 pb-6 px-5">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-full text-sm font-bold disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 font-medium">Page {page} of {data.pagination.totalPages}</span>
          <button
            disabled={page === data.pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-full text-sm font-bold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
