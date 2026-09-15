import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../../firebase';
import { apiFetch, setAccessToken } from '../../api';
import type { UserProfile } from '../../types';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

declare global {
  interface Window { recaptchaVerifier: RecaptchaVerifier | null | undefined; }
}

export function CustomerSignup({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [verificationId, setVerificationId] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t, i18n } = useTranslation();
  const nativeAuth = Capacitor.isNativePlatform();
  const nativeListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const verifiedUserRef = useRef<import('firebase/auth').User | null>(null);
  const nativeVerifiedRef = useRef(false);

  useEffect(() => {
    if (!nativeAuth) return;
    let active = true;
    FirebaseAuthentication.addListener('phoneCodeSent', ({ verificationId: id }) => {
      if (!active) return;
      setVerificationId(id);
      setStep('otp');
      setCooldown(30);
      setLoading(false);
    }).then((handle) => {
      if (active) nativeListenerRef.current = handle;
      else void handle.remove();
    }).catch(() => {});
    return () => {
      active = false;
      const handle = nativeListenerRef.current;
      nativeListenerRef.current = null;
      if (handle) void handle.remove();
    };
  }, [nativeAuth]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function setupRecaptcha() {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'signup-recaptcha-container', {
        // Show the challenge on localhost so browser privacy settings do not
        // silently block the invisible verifier.
        size: 'normal'
      });
    }
    return window.recaptchaVerifier;
  }

  async function sendOtp() {
    verifiedUserRef.current = null;
    nativeVerifiedRef.current = false;
    setError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (name.trim().length < 2) return setError('Please enter your full name.');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) return setError('Enter a valid 10-digit Indian mobile number.');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return setError('Please enter a valid email address.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      if (nativeAuth) {
        setVerificationId('');
        await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: `+91${cleanPhone}` });
      } else {
        const result = await signInWithPhoneNumber(auth, `+91${cleanPhone}`, setupRecaptcha());
        setConfirmationResult(result);
        setStep('otp');
        setCooldown(30);
      }
    } catch (cause: any) {
      const code = cause?.code || '';
      const message = code === 'auth/network-request-failed'
        ? 'Firebase could not load the reCAPTCHA challenge. Check your connection and add localhost and 127.0.0.1 in Firebase Authorized domains.'
        : code === 'auth/too-many-requests'
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : code === 'auth/code-expired'
            ? 'This OTP has expired. Tap Resend OTP and enter the newest code.'
          : cause?.message || 'Unable to send the verification code.';
      setError(message);
      window.recaptchaVerifier?.clear();
      window.recaptchaVerifier = undefined;
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmationResult && !(nativeAuth && verificationId)) return;
    setError('');
    setLoading(true);
    try {
      let idToken: string;
      if (nativeAuth) {
        if (!nativeVerifiedRef.current) {
          await FirebaseAuthentication.confirmVerificationCode({ verificationId, verificationCode: otp.trim() });
          nativeVerifiedRef.current = true;
        }
        idToken = (await FirebaseAuthentication.getIdToken()).token;
      } else {
        if (!verifiedUserRef.current) {
          const result = await confirmationResult!.confirm(otp.trim());
          verifiedUserRef.current = result.user;
        }
        idToken = await verifiedUserRef.current.getIdToken(true);
      }
      if (!idToken) {
        const currentUser = auth.currentUser;
        if (currentUser) idToken = await currentUser.getIdToken(true);
      }
      if (!idToken) throw new Error('Phone verification did not return a secure token. Please request a new OTP.');
      const data = await apiFetch<{ accessToken: string; user: UserProfile }>('/api/auth/customer/signup', {
        method: 'POST',
        body: JSON.stringify({ idToken, name: name.trim(), email: email.trim(), password }),
      });
      setAccessToken(data.accessToken);
      onLogin(data.user);
    } catch (cause: any) {
      setError(cause?.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="theme-green h-full w-full">
      <div className="login-screen">
        <div className="login-brand-panel">
          <div className="login-brand"><img src="/logo.png" alt="AE" style={{ width: 320, height: 'auto', background: '#fff', borderRadius: 16, padding: 12 }} /></div>
          <h1>Join AE</h1>
          <p>Create your account, earn rewards, and discover participating merchants.</p>
        </div>
        <div className="login-form-panel">
          <div className="login-form">
            <div className="login-mobile-brand"><img src="/logo.png" alt="AE" style={{ width: 220, height: 'auto', margin: '0 auto 20px' }} /></div>
            <h2>{step === 'details' ? 'Create Customer Account' : 'Verify Your Phone'}</h2>
            <label className="login-language"><Languages size={17} /><select value={i18n.language.startsWith('ml') ? 'ml' : 'en'} onChange={(event) => void i18n.changeLanguage(event.target.value)} aria-label={t('language.malayalam')}><option value="en">{t('language.english')}</option><option value="ml">{t('language.malayalam')}</option></select></label>
            <p>{step === 'details' ? 'Enter your details to get started.' : `We sent a 6-digit code to +91 ${phone}.`}</p>
            <div style={{ margin: '18px 0 4px' }}>
              {/* Keep this mounted during OTP entry so Firebase can reuse the
                  verifier safely when the user requests a resend. */}
              <div id="signup-recaptcha-container" />
              {step === 'details' ? (
                <small style={{ display: 'block', marginTop: '8px', color: '#6b7280' }}>
                  Complete the security check when it appears, then the OTP will be sent.
                </small>
              ) : null}
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            {step === 'details' ? (
              <form onSubmit={(event) => { event.preventDefault(); void sendOtp(); }}>
                <label><span>Full Name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>
                <label><span>Phone Number</span><div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}><span style={{ position: 'absolute', left: 16, fontWeight: 'bold', color: '#6b7280' }}>+91</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit number" style={{ width: '100%', paddingLeft: 54 }} required /></div></label>
                <label><span>Email (optional)</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
                <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
                <label><span>Confirm Password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
                <button className="button primary login-button" disabled={loading}>{loading ? 'Sending code...' : 'Send OTP'}</button>
              </form>
            ) : (
              <form onSubmit={verifyOtp}>
                <label><span>6-Digit OTP</span><input inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" required /></label>
                <button className="button primary login-button" disabled={loading || otp.length !== 6}>{loading ? 'Creating account...' : 'Verify & Create Account'}</button>
                <button type="button" className="button secondary login-button" disabled={loading || cooldown > 0} onClick={() => void sendOtp()}>{cooldown ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}</button>
              </form>
            )}
            <div className="login-links"><Link to="/customer/login">Back to Customer Login</Link></div>
          </div>
        </div>
      </div>
    </div>
  );
}
