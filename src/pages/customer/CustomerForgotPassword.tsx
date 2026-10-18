import { uiText } from '../../uiText';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../api';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '../../firebase';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';
import { createNativePhoneReset, phoneResetError } from '../../nativePhoneReset';

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
  const nativeControllerRef = useRef<ReturnType<typeof createNativePhoneReset> | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const mountedRef = useRef(true);
  const sentPhoneRef = useRef('');
  const [nativeVerified, setNativeVerified] = useState(false);
  const nativeAuth = Capacitor.isNativePlatform();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void nativeControllerRef.current?.then(controller => controller.dispose()).catch(() => {});
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const [verificationId, setVerificationId] = useState('');

  const setupRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
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
    setNativeVerified(false);
    setVerificationId('');
    setConfirmationResult(null);
    setOtp('');
    try {
      const fullPhone = '+91' + cleanPhone;
      sentPhoneRef.current = fullPhone;
      if (nativeAuth) {
        await nativeControllerRef.current?.then(controller => controller.dispose());
        nativeControllerRef.current = createNativePhoneReset(FirebaseAuthentication, () => {
          if (mountedRef.current) { setNativeVerified(true); setStep('otp'); }
        });
        const controller = await nativeControllerRef.current;
        if (!mountedRef.current) { await controller.dispose(); return; }
        const result = await controller.start(fullPhone);
        if (!mountedRef.current) return;
        if (result.kind === 'sms') setVerificationId(result.verificationId);
        setStep('otp');
      } else {
        setupRecaptcha();
        const appVerifier = recaptchaRef.current!;
        const confirmation = await signInWithPhoneNumber(auth, fullPhone, appVerifier);
        if (!mountedRef.current) return;
        setConfirmationResult(confirmation);
        setStep('otp');
      }
    } catch (err: unknown) {
      if (mountedRef.current) setError(phoneResetError(err));
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  const requestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void sendOtp();
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || (!confirmationResult && !(nativeAuth && (verificationId || nativeVerified)))) return;
    if (!nativeVerified && !/^\d{6}$/.test(otp.trim())) { setError('Enter the 6-digit SMS code.'); return; }
    setError('');
    setLoading(true);
    try {
      let idToken: string;
      if (nativeAuth) {
        if (!nativeVerified) await FirebaseAuthentication.confirmVerificationCode({ verificationId, verificationCode: otp.trim() });
        const current = await FirebaseAuthentication.getCurrentUser();
        if (current.user?.phoneNumber !== sentPhoneRef.current) throw new Error('Phone verification did not match the requested number.');
        idToken = (await FirebaseAuthentication.getIdToken({ forceRefresh: true })).token;
      } else {
        const result = await confirmationResult!.confirm(otp.trim());
        idToken = await result.user.getIdToken(true);
      }
      if (!idToken) throw new Error('Phone verification did not return a secure token. Please request a new SMS code.');
      
      // Send token and new password to backend to update Supabase DB
      await apiFetch('/api/auth/customer/reset-password-otp', {
        method: 'POST',
        body: JSON.stringify({ idToken, newPassword: password }),
      });
      
      // Sign out from Firebase client since we use our own auth session
      if (nativeAuth) await FirebaseAuthentication.signOut().catch(() => {});
      else await auth.signOut().catch(() => {});
      
      setSuccess(true);
    } catch (err: unknown) {
      const status = err && typeof err === 'object' && 'status' in err ? Number(err.status) : 0;
      setError(status === 404 ? 'No account found for this verified phone number.' : status ? 'Unable to reset your password. Please try again or contact AE support.' : phoneResetError(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-screen">
        <div className="login-form-panel" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
          <div className="login-form" style={{ textAlign: 'center' }}>
            <div className="login-mobile-brand"><img src="/logo.png" alt={uiText("AE")} style={{ width: 160, height: 'auto', margin: '0 auto 20px' }} /></div>
            <h2>{uiText("Password Reset!")}</h2>
            <p>{uiText("Your customer password has been successfully reset.")}</p>
            <button 
              onClick={() => window.location.href = '/customer/login'} 
              className="button primary login-button" 
              style={{ marginTop: '24px' }}
            >{uiText(" Back to Login ")}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <ThemeToggleButton />
      <div className="login-form-panel" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <div className="login-form">
          <div className="login-mobile-brand"><img src="/logo.png" alt={uiText("AE")} style={{ width: 160, height: 'auto', margin: '0 auto 20px' }} /></div>
          <h2>{uiText("Reset Password")}</h2>
          <label className="login-language"><Languages size={17} /><select value={i18n.language.startsWith('ml') ? 'ml' : 'en'} onChange={(event) => void i18n.changeLanguage(event.target.value)} aria-label={t('language.malayalam')}><option value="en">{t('language.english')}</option><option value="ml">{t('language.malayalam')}</option></select></label>
          <p>{uiText(nativeVerified ? 'Your phone number is verified. Choose a new password.' : "We'll send a 6-digit SMS code to your number.")}</p>
          {step === 'phone' && !nativeAuth && (
            <div style={{ margin: '18px 0 4px' }}>
              <div id="recaptcha-container"></div>
              <small style={{ display: 'block', marginTop: '8px', color: '#6b7280' }}>{uiText(" Complete the security check when it appears, then the SMS code will be sent. ")}</small>
            </div>
          )}
          
          {error && <div className="form-error" role="alert">{uiText(error)}</div>}

          {step === 'phone' ? (
            <form onSubmit={requestOtp}>
              <label>
                <span>{uiText("Phone Number")}</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '16px', fontWeight: 'bold', color: '#6b7280' }}>+91</span>
                  <input
                    type="tel"
                    autoComplete="tel-national"
                    inputMode="numeric"
                    disabled={loading}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder={uiText("Enter 10-digit number")}
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
                {loading ? uiText("Sending...") : uiText("Send SMS Code")}
              </button>
            </form>
          ) : (
            <form onSubmit={resetPassword}>
              {!nativeVerified && <label>
                <span>{uiText("Enter 6-digit Code")}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  style={{ width: '100%', textAlign: 'center', letterSpacing: '0.5em', fontWeight: 'bold', fontSize: '20px' }}
                  required
                  maxLength={6}
                />
              </label>}
              <label>
                <span>{uiText("New Password")}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={uiText("Min. 8 characters")}
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
                {loading ? uiText("Resetting...") : uiText("Reset Password")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void nativeControllerRef.current?.then(controller => controller.dispose()).catch(() => {});
                  nativeControllerRef.current = null;
                  recaptchaRef.current?.clear(); recaptchaRef.current = null;
                  setNativeVerified(false); setVerificationId(''); setConfirmationResult(null);
                  setOtp(''); setPassword(''); setError(''); setStep('phone');
                }}
                style={{ width: '100%', marginTop: '16px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >{uiText(" Use a different number ")}</button>
            </form>
          )}

          <div style={{ marginTop: '30px', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
            <button 
              onClick={() => window.location.href = '/customer/login'} 
              className="button secondary" 
              style={{ width: '100%', textDecoration: 'none', textAlign: 'center' }}
            >{uiText(" Cancel ")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
