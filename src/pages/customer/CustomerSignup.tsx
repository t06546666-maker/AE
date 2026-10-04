import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../../firebase';
import { apiFetch, setAccessToken } from '../../api';
import type { UserProfile } from '../../types';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import '../../components/auth.css';

declare global {
  interface Window { recaptchaVerifier: RecaptchaVerifier | null | undefined; }
}

export function CustomerSignup({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [showPassword, setShowPassword] = useState(false);
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
      const data = await apiFetch<{ accessToken: string; refreshToken?: string; user: UserProfile }>('/api/auth/customer/signup', {
        method: 'POST',
        body: JSON.stringify({ idToken, name: name.trim(), email: email.trim(), password }),
      });
      setAccessToken(data.accessToken, data.refreshToken);
      onLogin(data.user);
    } catch (cause: any) {
      setError(cause?.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="ae-auth-page"><section className="ae-auth-signup">
    <Link className="ae-auth-back" to="/customer/login" aria-label="Back to login"><ArrowLeft/></Link>
    <header><img src="/logo.png" alt="AE"/><h1>Create an Account</h1><p>Where customers meet business and beyond</p></header>
    <ol className="ae-auth-steps"><li aria-current={step === 'details' ? 'step' : undefined}><span>1</span>Account Details</li><li aria-current={step === 'otp' ? 'step' : undefined}><span>2</span>Verify &amp; Join</li></ol>
    <h2>{step === 'details' ? 'Your Details' : 'Verify your phone'}</h2><p className="ae-auth-subtitle">{step === 'details' ? 'Let’s create your AE account' : `Enter the code sent to +91 ${phone}`}</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    {step === 'details' ? <form onSubmit={e => {e.preventDefault(); void sendOtp();}}>
      <label className="ae-auth-field"><UserRound/><input aria-label="Full name" placeholder="Full Name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required/></label>
      <label className="ae-auth-field"><Mail/><input aria-label="Email (optional)" placeholder="Email (optional)" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label className="ae-auth-field"><Phone/><input aria-label="Mobile number" placeholder="+91 · Mobile Number" type="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0,10))} required/></label>
      <label className="ae-auth-field"><LockKeyhole/><input aria-label="Create password" placeholder="Create Password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <Eye/> : <EyeOff/>}</button></label>
      <label className="ae-auth-field"><LockKeyhole/><input aria-label="Confirm password" placeholder="Confirm Password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required/></label>
      <button className="ae-auth-primary" disabled={loading}>{loading ? 'Sending code…' : 'Continue'}<ArrowRight/></button>
    </form> : <form onSubmit={verifyOtp}>
      <label className="ae-auth-field"><Phone/><input aria-label="6-digit OTP" placeholder="6-digit OTP" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0,6))} required/></label>
      <button className="ae-auth-primary" disabled={loading || otp.length !== 6}>{loading ? 'Creating account…' : 'Verify & Create Account'}<ArrowRight/></button>
      <button type="button" className="ae-auth-secondary" disabled={loading || cooldown > 0} onClick={() => void sendOtp()}>{cooldown ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}</button>
    </form>}
    <div id="signup-recaptcha-container"/>
    <p className="ae-auth-bottom">Already have an account? <Link to="/customer/login">Login</Link></p>
  </section></main>;
}
