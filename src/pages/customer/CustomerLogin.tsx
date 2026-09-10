import { useState } from 'react';
import { Link } from 'react-router-dom';
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
    <div className="login-screen">
      <div className="login-brand-panel">
        <div className="login-brand"><span>Affiliate</span><small>AE</small></div>
        <h1>Welcome Back</h1>
        <p>Log in to your Customer account to view your rewards and order history.</p>
        <div className="login-features">
          {/* Decorative features similar to Merchant login */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '24px' }}>🎁</span>
            <span style={{ fontSize: '15px' }}><strong>Earn Rewards</strong><br/><span style={{ color: '#a7f3d0' }}>Get points for every purchase at participating merchants.</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '24px' }}>📱</span>
            <span style={{ fontSize: '15px' }}><strong>WhatsApp Ordering</strong><br/><span style={{ color: '#a7f3d0' }}>Order directly via WhatsApp and track your status.</span></span>
          </div>
        </div>
      </div>
      
      <div className="login-form-panel">
        <div className="login-form">
          <div className="login-mobile-brand">Affiliate <span>AE</span></div>
          <h2>Customer Login</h2>
          <p>Please enter your mobile number to receive a login code via WhatsApp.</p>
          
          {error && <div className="form-error">{error}</div>}

          <form onSubmit={submit}>
            <label>
              <span>Phone Number</span>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '16px', fontWeight: 'bold', color: '#6b7280' }}>+91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit number"
                  style={{ width: '100%', paddingLeft: '54px' }}
                  required
                />
              </div>
            </label>
            <label>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Password</span>
                <Link to="/customer/forgot-password" style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--brand-color)', textDecoration: 'none' }}>Forgot password?</Link>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{ width: '100%', paddingRight: '40px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7280', display: 'flex' }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <span style={{ fontSize: '12px', fontWeight: 600 }}>HIDE</span> : <span style={{ fontSize: '12px', fontWeight: 600 }}>SHOW</span>}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="button primary login-button"
              style={{ marginTop: '24px' }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '30px', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>Are you a merchant?</p>
            <button 
              onClick={() => window.location.href = '/login'} 
              className="button secondary" 
              style={{ width: '100%', textDecoration: 'none', textAlign: 'center' }}
            >
              Merchant Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
