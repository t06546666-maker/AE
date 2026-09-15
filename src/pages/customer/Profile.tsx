import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, LogOut, ChevronRight, Gift, Clock, Heart, HelpCircle, Shield, ArrowLeft, Star, X, Phone, Mail, MessageCircle } from 'lucide-react';
import { UserProfile } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useCustomerMerchants } from '../../hooks/useCustomerData';
import { apiFetch } from '../../api';

export function CustomerProfile({ user, onLogout }: { user: UserProfile; onLogout: () => void }) {
  const [showHelp, setShowHelp] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'app' | 'merchant'>('app');
  const [feedbackMerchant, setFeedbackMerchant] = useState('');
  const [feedbackRating, setFeedbackRating] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [editName, setEditName] = useState(user.name || '');
  const [editMode, setEditMode] = useState(false);
  
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const { pushEnabled, locationEnabled, requestPush, requestLocation, setWhatsApp } = usePermissions();
  const { data: merchantData } = useCustomerMerchants(1);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleWhatsAppHelp = () => {
    const msg = encodeURIComponent('Hi, I need help with my AE Rewards account.');
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const submitFeedback = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedbackStatus('');
    try {
      await apiFetch('/api/customer/feedback', { method: 'POST', body: JSON.stringify({ feedback_type: feedbackType, merchant_id: feedbackMerchant || undefined, rating: feedbackRating || undefined, message: feedbackMessage }) });
      setFeedbackMessage(''); setFeedbackRating(''); setFeedbackStatus('Thank you. Your feedback was sent.');
    } catch (error: any) { setFeedbackStatus(error.message || 'Unable to send feedback.'); }
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
          <button onClick={() => { setSelectedFaq(null); setShowHelp(true); }} className="w-full p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4">
              <HelpCircle size={20} className="text-gray-400" />
              <span className="font-semibold text-[15px] text-gray-800">Help & Support</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
          <button onClick={() => { setFeedbackStatus(''); setShowFeedback(true); }} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors active:scale-[0.99]">
            <div className="flex items-center space-x-4"><MessageCircle size={20} className="text-gray-400" /><span className="font-semibold text-[15px] text-gray-800">Feedback & Reviews</span></div><ChevronRight size={18} className="text-gray-400" />
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
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-t-[32px] w-full max-w-[430px] p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2"><MessageCircle size={20} className="text-[#087a4b]" /><h2 className="text-[18px] font-bold text-gray-900">Help & Support</h2></div>
              <button onClick={() => setShowHelp(false)}><X size={22} className="text-gray-500" /></button>
            </div>
            <div className="mb-5 rounded-[16px] bg-gray-50 p-4">
              <p className="mb-3 text-[13px] font-bold text-gray-800">Quick answers</p>
              {[
                ['points', 'How do I earn AE Points?', 'Scan your AE QR at a participating shop after purchase. Points are added to your account once the transaction is confirmed.'],
                ['redeem', 'How do I redeem points?', 'Open Rewards, choose an available reward, and tap Redeem. Your points balance will update after confirmation.'],
                ['login', 'I cannot sign in or receive an OTP.', 'Check your phone number and internet connection, then request a new OTP. Wait for the resend timer before trying again.'],
                ['missing', 'My points or transaction is missing.', 'Please keep your purchase details and contact AE support so we can check the transaction.'],
              ].map(([id, question, answer]) => (
                <div key={id} className="border-b border-gray-200 last:border-0">
                  <button onClick={() => setSelectedFaq(selectedFaq === id ? null : id)} className="w-full py-2.5 text-left text-[13px] font-semibold text-gray-800">{question}</button>
                  {selectedFaq === id && <p className="pb-3 text-[12px] leading-relaxed text-gray-600">{answer}</p>}
                </div>
              ))}
            </div>
            <div className="mb-4 rounded-[16px] border border-[#bfe8d2] bg-[#effaf4] p-4">
              <p className="text-[13px] font-bold text-gray-900">Still need help?</p>
              <p className="mt-1 text-[12px] text-gray-600">Chat with AE support on WhatsApp or email us. Add your official support number as <code>VITE_AE_SUPPORT_PHONE</code> in your deployment settings to show a Call AE option here.</p>
              {import.meta.env.VITE_AE_SUPPORT_PHONE && <a href={`tel:${import.meta.env.VITE_AE_SUPPORT_PHONE}`} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#087a4b] px-4 py-2 text-[12px] font-bold text-white"><Phone size={14} /> Call AE support</a>}
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

      {showFeedback && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40" onClick={() => setShowFeedback(false)}>
          <form onSubmit={submitFeedback} className="feedback-modal bg-white rounded-t-[32px] w-full max-w-[430px] p-6 pb-10 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h2 className="text-[18px] font-bold text-gray-900">Feedback & Reviews</h2><button type="button" onClick={() => setShowFeedback(false)}><X size={22} className="text-gray-500" /></button></div>
            <div className="flex gap-2"><button type="button" onClick={() => setFeedbackType('app')} className={`flex-1 rounded-xl p-3 text-[12px] font-bold ${feedbackType === 'app' ? 'bg-[#087a4b] text-white' : 'bg-gray-100 text-gray-600'}`}>App feedback</button><button type="button" onClick={() => setFeedbackType('merchant')} className={`flex-1 rounded-xl p-3 text-[12px] font-bold ${feedbackType === 'merchant' ? 'bg-[#087a4b] text-white' : 'bg-gray-100 text-gray-600'}`}>Merchant review</button></div>
            {feedbackType === 'merchant' && <select value={feedbackMerchant} onChange={e => setFeedbackMerchant(e.target.value)} required className="w-full rounded-xl border border-gray-200 p-3 text-sm"><option value="">Select a merchant</option>{(merchantData?.merchants || []).map(merchant => <option key={merchant.id} value={merchant.id}>{merchant.merchant_name}</option>)}</select>}
            {feedbackType === 'merchant' && <select value={feedbackRating} onChange={e => setFeedbackRating(e.target.value)} className="w-full rounded-xl border border-gray-200 p-3 text-sm"><option value="">Rating (optional)</option>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} / 5</option>)}</select>}
            <textarea value={feedbackMessage} onChange={e => setFeedbackMessage(e.target.value)} required minLength={2} maxLength={2000} rows={4} placeholder={feedbackType === 'app' ? 'Tell us about the AE app' : 'Review your experience with this merchant'} className="w-full rounded-xl border border-gray-200 p-3 text-sm" />
            {feedbackStatus && <p className="text-sm text-[#087a4b]">{feedbackStatus}</p>}
            <button type="submit" className="w-full rounded-xl bg-[#087a4b] p-3 font-bold text-white">Send feedback</button>
          </form>
        </div>
      )}

      {/* Privacy & Terms Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40" onClick={() => setShowPrivacy(false)}>
          <div className="bg-white rounded-t-[32px] w-full max-w-[430px] p-6 pb-10 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[18px] font-bold text-gray-900">Privacy & Terms</h2>
              <button onClick={() => setShowPrivacy(false)}><X size={22} className="text-gray-500" /></button>
            </div>
            <div className="space-y-4 text-[13px] text-gray-600 leading-relaxed">
              <p><strong className="text-gray-900">Privacy Policy</strong><br />We collect your phone number and transaction history solely to operate the AE Rewards program. We do not sell your data to third parties.</p>
              <p><strong className="text-gray-900">Data Storage</strong><br />Your data is stored securely and encrypted at rest. You can request deletion at any time by contacting support.</p>
              <p><strong className="text-gray-900">Terms of Use</strong><br />AE Points have no cash value and cannot be transferred. Points expire 1 year from the date they are issued. AE reserves the right to modify the program at any time.</p>
              <p><strong className="text-gray-900">Contact</strong><br />For questions, email support@affiliateae.com.</p>
            </div>
          </div>
        </div>
      )}

      {/* App Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40" onClick={() => setShowSettings(false)}>
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
                <button 
                  onClick={() => requestPush()}
                  className={`w-12 h-6 rounded-full relative transition-colors ${pushEnabled ? 'bg-[#087a4b]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${pushEnabled ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-[16px]">
                <div>
                  <p className="font-bold text-[14px] text-gray-900">WhatsApp Alerts</p>
                  <p className="text-[12px] text-gray-500">Point updates via WhatsApp</p>
                </div>
                <button 
                  onClick={() => {
                    const next = !whatsappEnabled;
                    setWhatsappEnabled(next);
                    setWhatsApp(next);
                  }}
                  className={`w-12 h-6 rounded-full relative transition-colors ${whatsappEnabled ? 'bg-[#087a4b]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${whatsappEnabled ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-[16px]">
                <div>
                  <p className="font-bold text-[14px] text-gray-900">Location Services</p>
                  <p className="text-[12px] text-gray-500">Find nearby merchants</p>
                </div>
                <button 
                  onClick={() => requestLocation()}
                  className={`w-12 h-6 rounded-full relative transition-colors ${locationEnabled ? 'bg-[#087a4b]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${locationEnabled ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
