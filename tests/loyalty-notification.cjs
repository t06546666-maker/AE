const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('server.js', 'utf8');
let route = source.slice(source.indexOf("app.post('/api/merchant/loyalty-bonus'"));
route = route.slice(0, route.indexOf('\n});') + 4).replace("await import('firebase-admin/firestore')", 'firestoreModule');
const id = '11111111-1111-4111-8111-111111111111';
let handler, pushes = [], claimed = false, rpcError = null, acceptsPush = true;
const claim = { create: async () => { if (claimed) throw Object.assign(new Error('Already claimed'), { code: 6 }); claimed = true; }, delete: async () => { claimed = false; } };
new Function('app', 'requireAuth', 'requireRole', 'supabaseAdmin', 'firebaseInitializationPromise', 'firestoreModule', 'pushToCustomer', route)(
  { post: (_url, _auth, _role, fn) => { handler = fn; } }, () => {}, () => () => {},
  { rpc: async () => ({ error: rpcError, data: { id, points: 20 } }) }, Promise.resolve(),
  { getFirestore: () => ({ collection: () => ({ doc: () => claim }) }) },
  async (...args) => { pushes.push(args); return acceptsPush; },
);
async function submit(points = 20) {
  let status = 200, body;
  const res = { status: value => { status = value; return res; }, json: value => { body = value; return res; } };
  await handler({ body: { points, customerId: id, requestId: id }, auth: { profile: { merchant_id: id }, user: { id } } }, res);
  return { status, body };
}
(async () => {
  const first = await submit();
  assert.equal(first.body.notificationSent, true);
  assert.equal(pushes.length, 1);
  assert.match(pushes[0][1], /Thank you for your loyalty/);
  assert.match(pushes[0][2], /20 AE loyalty points/);
  await submit(); assert.equal(pushes.length, 1);
  assert.equal((await submit(101)).status, 400); assert.equal(pushes.length, 1);
  rpcError = { message: 'Award failed' };
  assert.equal((await submit()).status, 400); assert.equal(pushes.length, 1);
  rpcError = null; claimed = false; acceptsPush = false;
  assert.equal((await submit()).body.success, true);
  assert.equal(claimed, false);
  console.log('Passed: award notification, thank-you text, duplicate prevention, cap and failed-award exclusion.');
})().catch(error => { console.error(error); process.exitCode = 1; });
