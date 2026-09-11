import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, LogOut, ChevronRight, Gift, Clock, Heart, HelpCircle, UserPlus, Shield, ArrowLeft, Star, X, Phone, Mail } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerProfile({ user, onLogout }: { user: UserProfile; onLogout: () => void }) {
  const [showHelp, setShowHelp] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState(user.name || '');
  const [editMode, setEditMode] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleWhatsAppHelp = () => {
    const msg = encodeURIComponent('Hi, I need help with my AE Rewards account.');
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans pb-[100px] flex flex-col relative">
      {/* Top Green Section */}
      <div className="bg-[#e9f8f0] pb-10 pt-4 px-5 rounded-b-[40px] shadow-sm relative z-10">
        <header className="flex justify-between items-center mb-6">
          <Link to="/customer/home" className="text-gray-800"><ArrowLeft size={24} /></Link>
          <button onClick={() => setShowSettings(true)} className="text-gray-800"><Settings size={24} /></button>
        </header>

        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-[#087a4b] rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4">
            {getInitials(editMode ? editName : user.name)}
          </div>
          {editMode ? (
            <div className="flex flex-col items-center gap-2 w-full max-w-[240px]">
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full text-center text-[16px] font-bold border-b-2 border-[#087a4b] bg-transparent outline-none text-gray-900 py-1"
                placeholder="Your name"
                autoFocus
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setEditMode(false)}
                  className="px-4 py-1.5 text-[12px] font-bold bg-gray-200 text-gray-600 rounded-full"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="px-4 py-1.5 text-[12px] font-bold bg-[#087a4b] text-white rounded-full"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-[20px] font-bold text-gray-900 leading-tight">{user.name || 'User'}</h2>
              <p className="text-[14px] text-[#087a4b] font-semibold mt-1">{user.phone}</p>
              <button
                onClick={() => setEditMode(true)}
                className="text-[12px] font-bold text-gray-500 mt-2 hover:text-[#087a4b] transition-colors"
              >
                Edit Profile
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-5 -mt-6 relative z-20 space-y-4">
        {/* Section 1 */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          <Link to="/customer/transactions" className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Star size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">My Points</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
          <Link to="/customer/rewards" className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Gift size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">My Rewards</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
          <Link to="/customer/transactions" className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Clock size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">My Transactions</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
          <Link to="/customer/explore" className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Heart size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">My Favorite Stores</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
        </div>

        {/* Section 2 */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          <Link to="/customer/referral" className="w-full p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <UserPlus size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">Refer a Friend</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-[#087a4b] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">Earn 100 Points</span>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
          </Link>
          <button onClick={handleWhatsAppHelp} className="w-full p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <HelpCircle size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">Help & Support</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
          <button onClick={() => setShowSettings(true)} className="w-full p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Settings size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">App Settings</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
          <button onClick={() => setShowPrivacy(true)} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <Shield size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">Privacy & Terms</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Section 3 */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          <button onClick={onLogout} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <LogOut size={20} className="text-gray-800" />
              <span className="font-semibold text-[15px] text-gray-800">Sign Out</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Help & Support Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-t-[32px] w-full max-w-[430px] p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[18px] font-bold text-gray-900">Help & Support</h2>
              <button onClick={() => setShowHelp(false)}><X size={22} className="text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <button onClick={handleWhatsAppHelp} className="w-full flex items-center gap-4 p-4 bg-green-50 rounded-[16px] text-left active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 bg-[#087a4b] rounded-full flex items-center justify-center">
                  <Phone size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-[14px] text-gray-900">Chat on WhatsApp</p>
                  <p className="text-[12px] text-gray-500">Get instant support</p>
                </div>
              </button>
              <a href="mailto:support@affiliateae.com" className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-[16px] text-left active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <Mail size={18} className="text-gray-600" />
                </div>
                <div>
                  <p className="font-bold text-[14px] text-gray-900">Email Support</p>
                  <p className="text-[12px] text-gray-500">support@affiliateae.com</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Privacy & Terms Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowPrivacy(false)}>
          <div className="bg-white rounded-t-[32px] w-full max-w-[430px] p-6 pb-10 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[18px] font-bold text-gray-900">Privacy & Terms</h2>
              <button onClick={() => setShowPrivacy(false)}><X size={22} className="text-gray-500" /></button>
            </div>
            <div className="space-y-4 text-[13px] text-gray-600 leading-relaxed">
              <p><strong className="text-gray-900">Privacy Policy</strong><br />We collect your phone number and transaction history solely to operate the AE Rewards program. We do not sell your data to third parties.</p>
              <p><strong className="text-gray-900">Data Storage</strong><br />Your data is stored securely and encrypted at rest. You can request deletion at any time by contacting support.</p>
              <p><strong className="text-gray-900">Terms of Use</strong><br />AE Points have no cash value and cannot be transferred. Points expire after 12 months of inactivity. AE reserves the right to modify the program at any time.</p>
              <p><strong className="text-gray-900">Contact</strong><br />For questions, email support@affiliateae.com.</p>
            </div>
          </div>
        </div>
      )}

      {/* App Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-t-[32px] w-full max-w-[430px] p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[18px] font-bold text-gray-900">App Settings</h2>
              <button onClick={() => setShowSettings(false)}><X size={22} className="text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-[16px]">
                <div>
                  <p className="font-bold text-[14px] text-gray-900">Push Notifications</p>
                  <p className="text-[12px] text-gray-500">Earn alerts & offers</p>
                </div>
                <button className="w-12 h-6 bg-[#087a4b] rounded-full relative transition-colors">
                  <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-[16px]">
                <div>
                  <p className="font-bold text-[14px] text-gray-900">WhatsApp Alerts</p>
                  <p className="text-[12px] text-gray-500">Point updates via WhatsApp</p>
                </div>
                <button className="w-12 h-6 bg-[#087a4b] rounded-full relative transition-colors">
                  <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-[16px]">
                <div>
                  <p className="font-bold text-[14px] text-gray-900">Location Services</p>
                  <p className="text-[12px] text-gray-500">Find nearby merchants</p>
                </div>
                <button className="w-12 h-6 bg-gray-300 rounded-full relative transition-colors">
                  <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
