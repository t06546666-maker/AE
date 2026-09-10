import { useState } from 'react';
import { apiFetch } from '../../api';

export function CustomerForgotPassword() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fullPhone = '+91' + phone.replace(/\D/g, '');
      await apiFetch('/api/auth/customer/forgot-password/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: fullPhone }),
      });
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fullPhone = '+91' + phone.replace(/\D/g, '');
      await apiFetch('/api/auth/customer/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify({ phone: fullPhone, otp, password }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Invalid code or password.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-screen">
        <div className="login-form-panel" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
          <div className="login-form" style={{ textAlign: 'center' }}>
            <div className="login-mobile-brand">Affiliate <span>AE</span></div>
            <h2>Password Reset!</h2>
            <p>Your customer password has been successfully reset.</p>
            <button 
              onClick={() => window.location.href = '/customer/login'} 
              className="button primary login-button" 
              style={{ marginTop: '24px' }}
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-form-panel" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <div className="login-form">
          <div className="login-mobile-brand">Affiliate <span>AE</span></div>
          <h2>Reset Password</h2>
          <p>We'll send a 6-digit code to your WhatsApp number.</p>
          
          {error && <div className="form-error">{error}</div>}

          {step === 'phone' ? (
            <form onSubmit={requestOtp}>
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
              <button
                type="submit"
                disabled={loading}
                className="button primary login-button"
                style={{ marginTop: '24px' }}
              >
                {loading ? 'Sending...' : 'Send WhatsApp Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={resetPassword}>
              <label>
                <span>Enter 6-digit Code</span>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  style={{ width: '100%', textAlign: 'center', letterSpacing: '0.5em', fontWeight: 'bold', fontSize: '20px' }}
                  required
                  maxLength={6}
                />
              </label>
              <label>
                <span>New Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{ width: '100%' }}
                  required
                  minLength={8}
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="button primary login-button"
                style={{ marginTop: '24px' }}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
              <button
                type="button"
                onClick={() => setStep('phone')}
                style={{ width: '100%', marginTop: '16px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                Use a different number
              </button>
            </form>
          )}

          <div style={{ marginTop: '30px', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
            <button 
              onClick={() => window.location.href = '/customer/login'} 
              className="button secondary" 
              style={{ width: '100%', textDecoration: 'none', textAlign: 'center' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
