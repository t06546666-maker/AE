import { useState } from 'react';
import { apiFetch, setAccessToken } from '../../api';
import { UserProfile } from '../../types';

export function CustomerLogin({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/auth/customer/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<{ accessToken: string; user: UserProfile }>('/api/auth/customer/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
      });
      setAccessToken(data.accessToken);
      onLogin(data.user);
    } catch (err: any) {
      setError(err.message || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Affiliate <span className="text-[#0d9254]">AE</span></h1>
          <p className="text-gray-500 text-sm mt-2 font-medium">Log in to view your rewards</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium text-center">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+971 50 123 4567"
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-lg rounded-xl focus:ring-[#0d9254] focus:border-[#0d9254] block p-3 font-medium transition-all"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white bg-[#0d9254] hover:bg-[#0a7a46] focus:ring-4 focus:ring-green-300 font-bold rounded-xl text-lg px-5 py-4 text-center transition-all disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Enter 6-digit Code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-center text-2xl tracking-[0.5em] rounded-xl focus:ring-[#0d9254] focus:border-[#0d9254] block p-3 font-bold transition-all"
                required
                maxLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white bg-[#0d9254] hover:bg-[#0a7a46] focus:ring-4 focus:ring-green-300 font-bold rounded-xl text-lg px-5 py-4 text-center transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full text-gray-500 font-medium text-sm mt-4 hover:text-gray-900 transition-colors"
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
