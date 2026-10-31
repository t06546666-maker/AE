const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('src/nativePhoneReset.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const scope = { exports: {}, setTimeout, clearTimeout };
vm.runInNewContext(code, scope);
const { createNativePhoneReset, phoneResetError } = scope.exports;
function fakeAuth() {
  const listeners = new Map(); let calls = 0; let removed = 0; let options;
  return { listeners, get options(){return options;}, get calls() { return calls; }, get removed() { return removed; },
    async addListener(name, callback) { listeners.set(name, callback); return { async remove() { removed++; listeners.delete(name); } }; },
    async signInWithPhoneNumber(value) { calls++; options=value; },
  };
}
async function main() {
  const auth = fakeAuth(); let automatic = 0;
  const controller = await createNativePhoneReset(auth, () => automatic++, 500);
  auth.listeners.get('phoneCodeSent')({ verificationId: 'stale' }); // retained event before a request
  let settled = false;
  const sent = controller.start('+919000000001').then(proof => { settled = true; return proof; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(settled, false, 'Native initiation is not SMS success');
  await assert.rejects(controller.start('+919000000001'), /already in progress/);
  assert.equal(auth.calls, 1);
  auth.listeners.get('phoneCodeSent')({ verificationId: 'new-session' });
  assert.deepEqual(JSON.parse(JSON.stringify(await sent)), { kind: 'sms', verificationId: 'new-session' });
  auth.listeners.get('phoneVerificationCompleted')({});
  assert.equal(automatic, 1, 'Automatic verification after SMS is handled');
  const resend=controller.start('+919000000001',true);
  assert.equal(auth.options.resendCode,true);
  auth.listeners.get('phoneCodeSent')({verificationId:'resent-session'});
  assert.equal((await resend).verificationId,'resent-session');
  await controller.dispose();
  assert.equal(auth.removed, 3);
  await assert.rejects(controller.start('+919000000001'), /no longer active/);

  const rejectedAuth = fakeAuth();
  const rejected = await createNativePhoneReset(rejectedAuth, () => {}, 500);
  const failure = rejected.start('+919000000001');
  rejectedAuth.listeners.get('phoneVerificationFailed')({ message: 'invalid app credential' });
  await assert.rejects(failure, /invalid app credential/);
  await rejected.dispose();

  const instantAuth = fakeAuth();
  const instant = await createNativePhoneReset(instantAuth, () => automatic++, 500);
  const verified = instant.start('+919000000001');
  instantAuth.listeners.get('phoneVerificationCompleted')({});
  assert.equal((await verified).kind, 'verified');
  await instant.dispose();

  const timeout = await createNativePhoneReset(fakeAuth(), () => {}, 10);
  await assert.rejects(timeout.start('+919000000001'), /timed out/);
  await timeout.dispose();
  const cancel = await createNativePhoneReset(fakeAuth(), () => {}, 500);
  const pending = cancel.start('+919000000001');
  const cancelled = assert.rejects(pending, /cancelled/);
  await cancel.dispose(); await cancelled;
  assert.match(phoneResetError({code:'auth/invalid-app-credential'}), /could not be verified/);
  assert.match(phoneResetError({message:'ERROR_INVALID_APP_CREDENTIAL'}), /could not be verified/);
  assert.match(phoneResetError({code:'auth/invalid-verification-code'}), /incorrect/);
  assert.match(phoneResetError({code:'auth/code-expired'}), /expired/);
  assert.match(phoneResetError({message:'private server details'}), /contact AE support/);
  const page = fs.readFileSync('src/pages/customer/CustomerForgotPassword.tsx', 'utf8');
  assert.ok(page.includes("step === 'phone' && !nativeAuth"), 'Web CAPTCHA must not render inside Android');
  assert.ok(page.includes('current.user?.phoneNumber !== sentPhoneRef.current'), 'Verified account must match the requested number');
  assert.ok(!page.includes('onBlur='), 'Do not send duplicate SMS on input blur');
  console.log('PASS: native callback lifecycle, delayed failure, instant verification, timeout, duplicate-send prevention, cleanup and safe reset errors');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
