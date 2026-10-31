import type { FirebaseAuthentication } from '@capacitor-firebase/authentication';

type NativeAuth = Pick<typeof FirebaseAuthentication, 'addListener' | 'signInWithPhoneNumber'>;
type Proof = { kind: 'sms'; verificationId: string } | { kind: 'verified' };

// Native signInWithPhoneNumber only starts verification. Its promise resolving
// does NOT mean an SMS was sent: the result arrives through these callbacks.
export async function createNativePhoneReset(auth: NativeAuth, onVerified: () => void, timeoutMs = 120_000) {
  const handles: Array<{ remove(): Promise<void> }> = [];
  let disposed = false;
  let active = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { resolve(value: Proof): void; reject(error: Error): void } | null = null;
  const finish = (result?: Proof, error?: Error) => {
    clearTimeout(timer);
    const request = pending;
    pending = null;
    if (error) { active = false; request?.reject(error); }
    else if (result) request?.resolve(result);
  };
  try {
    handles.push(await auth.addListener('phoneCodeSent', event => {
      if (!disposed && active && event.verificationId) finish({ kind: 'sms', verificationId: event.verificationId });
    }));
    handles.push(await auth.addListener('phoneVerificationFailed', event => {
      if (!disposed && active && pending) finish(undefined, new Error(event.message || 'Failed to send SMS code.'));
    }));
    handles.push(await auth.addListener('phoneVerificationCompleted', () => {
      if (disposed || !active) return;
      onVerified();
      finish({ kind: 'verified' });
    }));
  } catch (error) {
    await Promise.all(handles.map(handle => handle.remove().catch(() => {})));
    throw error;
  }
  return {
    start(phoneNumber: string, resendCode = false): Promise<Proof> {
      if (disposed) return Promise.reject(new Error('Phone verification is no longer active.'));
      if (pending) return Promise.reject(new Error('An SMS request is already in progress.'));
      active = true;
      return new Promise<Proof>((resolve, reject) => {
        pending = { resolve, reject };
        timer = setTimeout(() => finish(undefined, new Error('Phone verification timed out. Please try again.')), timeoutMs);
        void auth.signInWithPhoneNumber({ phoneNumber, resendCode }).catch(error => finish(undefined, error));
      });
    },
    async dispose() {
      disposed = true;
      active = false;
      finish(undefined, new Error('Phone verification was cancelled.'));
      await Promise.all(handles.map(handle => handle.remove().catch(() => {})));
    },
  };
}

export function phoneResetError(error: unknown): string {
  const detail = error && typeof error === 'object' ? error as { code?: string; message?: string } : {};
  const message = `${detail.code || ''} ${detail.message || ''}`.toLowerCase();
  if (/invalid.app.credential|invalid app credential|app.not.authorized|app not authorized|invalid.cert.hash|play.?integrity|captcha.check.failed|captcha check failed/.test(message)) return 'This app could not be verified. Please contact AE support if this continues.';
  if (/too.many.requests|too many requests|quota.exceeded|sms.quota/.test(message)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (/invalid.verification.code|invalid verification code/.test(message)) return 'That SMS code is incorrect. Check the newest message and try again.';
  if (/code.expired|session.expired|session has expired/.test(message)) return 'That SMS code has expired. Go back and request a new one.';
  if (/network.request.failed|network error/.test(message)) return 'Check your internet connection and try again.';
  if (/timed out/.test(message)) return 'Phone verification timed out. Please try again.';
  return 'Unable to verify your number. Please try again or contact AE support.';
}
