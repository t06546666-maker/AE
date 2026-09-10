import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { apiFetch, setAccessToken } from '../../api';
import { UserProfile } from '../../types';

export function CustomerLogin({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fullPhone = '+91' + phone.replace(/\D/g, '');
      const data = await apiFetch<{ accessToken: string; user: UserProfile }>('/api/auth/customer/login', {
        method: 'POST',
        body: JSON.stringify({ phone: fullPhone, password }),
      });
      setAccessToken(data.accessToken);
      onLogin(data.user);
    } catch (err: any) {
      setError(err.message || 'Invalid phone or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen flex flex-col font-sans text-gray-900">
      {/* Decorative Top Background */}
      <div className="bg-[#087a4b] h-[30vh] w-full rounded-b-[40px] flex flex-col items-center justify-center relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2"></div>
        <div className="relative z-10 flex flex-col items-center">
          <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-md mb-2">AE</h1>
          <p className="text-green-50/90 font-medium tracking-wide">Customer Portal</p>
        </div>
      </div>

      {/* Login Form Container */}
      <div className="flex-1 px-6 -mt-10 relative z-10 pb-10">
        <div className="bg-white rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100">
          <h2 className="text-[24px] font-bold text-gray-900 mb-2">Welcome Back</h2>
          <p className="text-[14px] text-gray-500 mb-8 leading-snug">
            Enter your mobile number and temporary password to access your rewards.
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-2xl text-[13px] font-medium mb-6 flex items-start gap-2 border border-red-100">
              <span className="mt-0.5">⚠️</span>
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            {/* Phone Number Input */}
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-2 uppercase tracking-wide">Phone Number</label>
              <div className="relative flex items-center">
                <div className="absolute left-4 font-bold text-gray-800 pointer-events-none">+91</div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10 digits"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-[16px] py-4 pl-[52px] pr-4 focus:outline-none focus:ring-2 focus:ring-[#087a4b] focus:border-transparent transition-all text-[16px] font-medium"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">Password</label>
                <Link to="/customer/forgot-password" className="text-[13px] font-bold text-[#087a4b] hover:underline">
                  Forgot?
                </Link>
              </div>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-[16px] py-4 pl-4 pr-[70px] focus:outline-none focus:ring-2 focus:ring-[#087a4b] focus:border-transparent transition-all text-[16px] font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-[12px] font-bold text-gray-500 hover:text-gray-800 uppercase tracking-wider"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#087a4b] text-white font-bold rounded-[20px] py-4 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform mt-8 shadow-[0_8px_20px_rgba(8,122,75,0.25)] disabled:opacity-70 disabled:active:scale-100"
            >
              {loading ? 'Signing In...' : 'Sign In'}
              {!loading && <ChevronRight size={20} />}
            </button>
          </form>
        </div>

        {/* Merchant Link */}
        <div className="mt-8 text-center px-4">
          <p className="text-[14px] text-gray-500 mb-3">Are you a merchant?</p>
          <a
            href="/login"
            className="inline-block w-full py-3.5 px-6 bg-white border border-gray-200 text-gray-700 font-bold rounded-[16px] active:scale-[0.98] transition-transform shadow-sm"
          >
            Merchant Login
          </a>
        </div>
      </div>
    </div>
  );
}
