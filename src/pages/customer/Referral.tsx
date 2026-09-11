import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Gift, Copy, Share2, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserProfile } from '../../types';
import { useCustomerApplyReferral } from '../../hooks/useCustomerData';

export function CustomerReferral({ user }: { user: UserProfile }) {
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const { mutate: applyReferral, isPending } = useCustomerApplyReferral();

  const referralCode = `AE-${user.phone?.slice(-4) || '1234'}`;

  const showToast = (text: string, ok: boolean) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join Affiliate AE',
        text: `Use my referral code ${referralCode} to get 100 AE Points when you sign up!`,
        url: window.location.origin,
      }).catch(console.error);
    } else {
      handleCopy();
    }
  };

  const handleApplyCode = () => {
    if (!code.trim()) return;
    applyReferral(code.trim(), {
      onSuccess: (data) => {
        setCode('');
        showToast(`🎉 ${data.points_awarded ?? 100} points added to your account!`, true);
      },
      onError: (err: any) => {
        showToast(err?.message || 'Invalid or already used code.', false);
      },
    });
  };

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col relative pb-[100px] font-sans">
      {/* Header */}
      <header className="flex items-center px-5 py-4 sticky top-0 z-20 bg-gray-50">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/profile"><ArrowLeft size={24} /></Link>
          <h1 className="text-[19px] font-bold">Refer a Friend</h1>
        </div>
      </header>

      <div className="px-5 pt-4 flex-1 flex flex-col items-center">
        {/* Illustration */}
        <div className="w-24 h-24 bg-[#e9f8f0] rounded-full flex items-center justify-center mb-6 shadow-sm border border-green-50">
          <Gift size={44} className="text-[#087a4b]" />
        </div>

        <h2 className="text-[24px] font-bold text-gray-900 mb-2 text-center tracking-tight">Invite & Earn</h2>
        <p className="text-[14px] text-gray-500 text-center mb-8 px-4 leading-relaxed">
          Share your code with friends. When they sign up, you both get <strong className="text-[#087a4b]">100 AE Points!</strong>
        </p>

        {/* Share Code Section */}
        <div className="w-full bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 mb-6">
          <p className="text-[13px] font-bold text-gray-500 mb-3 uppercase tracking-wider text-center">Your Referral Code</p>

          <div className="relative w-full">
            <div className="w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-[16px] py-4 text-center mb-4 transition-colors">
              <span className="text-[24px] font-black text-gray-800 tracking-widest">{referralCode}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3.5 rounded-[14px] flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
            >
              {copied ? <CheckCircle2 size={18} className="text-[#087a4b]" /> : <Copy size={18} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleShare}
              className="flex-[2] bg-[#087a4b] hover:bg-[#0a8a55] text-white font-bold py-3.5 rounded-[14px] flex items-center justify-center gap-2 shadow-md shadow-green-600/20 transition-all active:scale-[0.98]"
            >
              <Share2 size={18} />
              Share Code
            </button>
          </div>
        </div>

        {/* Enter Code Section */}
        <div className="w-full bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <p className="text-[15px] font-bold text-gray-800 mb-1">Have a referral code?</p>
          <p className="text-[13px] text-gray-500 mb-4">Enter it below to claim your points.</p>

          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Enter code here"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full bg-gray-50 border border-gray-200 rounded-[14px] px-4 py-3.5 text-[15px] font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#087a4b] focus:ring-1 focus:ring-[#087a4b] transition-all"
            />
            <button
              onClick={handleApplyCode}
              disabled={!code.trim() || isPending}
              className="w-full bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-[14px] transition-all active:scale-[0.98]"
            >
              {isPending ? 'Applying...' : 'Apply Code'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg text-white text-[13px] font-bold transition-all ${toast.ok ? 'bg-[#087a4b]' : 'bg-red-500'}`}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.text}
        </div>
      )}
    </div>
  );
}
