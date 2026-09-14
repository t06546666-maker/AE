
declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier | null | undefined;
  }
}

import { useRef, useState } from 'react';
import { apiFetch } from '../../api';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '../../firebase';

export function CustomerForgotPassword() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const sendingRef = useRef(false);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        // A visible challenge is more reliable on localhost and lets the user
        // complete verification when browser privacy settings block the
        // invisible challenge.
        size: 'normal'
      });
    }
  };

  const sendOtp = async () => {
    if (sendingRef.current) return;
    setError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    sendingRef.current = true;
    setLoading(true);
    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier!;
      const fullPhone = '+91' + cleanPhone;
      const confirmation = await signInWithPhoneNumber(auth, fullPhone, appVerifier);
      setConfirmationResult(confirmation);
      setStep('otp');
    } catch (err: any) {
      const code = err?.code || '';
      const message = code === 'auth/network-request-failed'
        ? 'Firebase could not load the reCAPTCHA challenge. Check your connection and add localhost and 127.0.0.1 in Firebase Authorized domains.'
        : code === 'auth/too-many-requests'
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : err?.message || 'Failed to send SMS code.';
      setError(message);
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  const requestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void sendOtp();
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setError('');
    setLoading(true);
    try {
      // Verify OTP with Firebase
      const result = await confirmationResult.confirm(otp);
      
      // Get the ID Token to send to our backend
      const idToken = await result.user.getIdToken();
      
      // Send token and new password to backend to update Supabase DB
      await apiFetch('/api/auth/customer/reset-password-otp', {
        method: 'POST',
        body: JSON.stringify({ idToken, newPassword: password }),
      });
      
      // Sign out from Firebase client since we use our own auth session
      await auth.signOut();
      
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
            <div className="login-mobile-brand"><img src="/logo.png" alt="Affiliate AE" style={{ width: 160, height: 'auto', margin: '0 auto 20px' }} /></div>
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
          <div className="login-mobile-brand"><img src="/logo.png" alt="Affiliate AE" style={{ width: 160, height: 'auto', margin: '0 auto 20px' }} /></div>
          <h2>Reset Password</h2>
          <p>We'll send a 6-digit SMS code to your number.</p>
          {step === 'phone' && (
            <div style={{ margin: '18px 0 4px' }}>
              <div id="recaptcha-container"></div>
              <small style={{ display: 'block', marginTop: '8px', color: '#6b7280' }}>
                Complete the security check when it appears, then the SMS code will be sent.
              </small>
            </div>
          )}
          
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
                    onBlur={() => {
                      if (/^[6-9]\d{9}$/.test(phone) && !loading) void sendOtp();
                    }}
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
                {loading ? 'Sending...' : 'Send SMS Code'}
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
