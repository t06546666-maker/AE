const assert = require('node:assert/strict');
const { registerProductListFulfillment, normalizeStatus } = require('../backend/product-list-fulfillment.cjs');
let handler, row, events, failPush, failRead, failWrite;
const db = { from() {
  const filters = []; let changes;
  return { select() { return this; }, update(value) { changes = value; return this; }, eq(k,v) { filters.push([k,v]); return this; }, is(k,v) { filters.push([k,v]); return this; }, async maybeSingle() {
    if ((!changes && failRead) || (changes && failWrite)) return { error: new Error('database unavailable') };
    if (!row || filters.some(([k,v]) => (row[k] ?? null) !== v)) return { data: null };
    if (changes) Object.assign(row, changes);
    return { data: {...row} };
  }};
}};
registerProductListFulfillment({ patch(path, auth, role, fn) { assert.equal(path, '/api/product-list-requests/:id/status'); handler = fn; } }, { requireAuth(){}, requireRole(role){ assert.equal(role,'merchant'); return ()=>{}; }, db,
  pushToCustomer: async (...args) => { events.push(args); if (failPush) throw new Error('FCM offline'); }, pushToRole: async()=>{} });
function reset(status = 'approved', merchantStatus = null) { row = { id:'list1', customer_id:'owner', merchant_id:'shop1', status, merchant_status:merchantStatus }; events=[]; failPush=failRead=failWrite=false; }
async function invoke(status, merchantId='shop1') { const res = { code:200, status(code){this.code=code;return this;}, json(body){this.body=body;return this;} }; await handler({ params:{id:'list1'}, body:{status,customer_id:'attacker'}, auth:{profile:{merchant_id:merchantId}} },res); return res; }
(async()=>{
  assert.equal(normalizeStatus('accepted'),'confirmed'); assert.equal(normalizeStatus('pending'),null);
  reset(); assert.equal((await invoke('confirmed','other-shop')).code,404); assert.equal(events.length,0);
  reset('pending'); assert.equal((await invoke('ready')).code,409); assert.equal(events.length,0);
  reset('rejected'); assert.equal((await invoke('confirmed')).code,409);
  reset(); assert.equal((await invoke('unknown')).code,400);
  reset(); assert.equal((await invoke('accepted')).body.request.status,'confirmed'); assert.equal(row.status,'approved');
  assert.equal((await invoke('in_progress')).code,200); assert.equal((await invoke('confirmed')).code,409);
  assert.equal((await invoke('ready')).code,200); assert.equal(row.merchant_status,'ready'); assert.equal(row.status,'approved');
  const ready=events.filter(e=>e[1]==='Your order is ready'); assert.equal(ready.length,1); assert.equal(ready[0][0],'owner'); assert.equal(ready[0][3].requestId,'list1'); assert.match(ready[0][3].url,/productList=1&requestId=list1/);
  assert.equal((await invoke('ready')).code,200); assert.equal(events.filter(e=>e[1]==='Your order is ready').length,1); assert.equal((await invoke('rejected')).code,409);
  reset(); assert.equal((await invoke('rejected')).code,200); assert.equal((await invoke('ready')).code,409);
  reset(); const concurrent=await Promise.all([invoke('confirmed'),invoke('rejected')]); assert.deepEqual(concurrent.map(r=>r.code).sort(),[200,409]); assert.equal(events.length,1);
  reset(); failWrite=true; assert.equal((await invoke('ready')).code,503); assert.equal(events.length,0); assert.equal(row.merchant_status,null);
  reset(); failRead=true; assert.equal((await invoke('ready')).code,503);
  reset(); failPush=true; assert.equal((await invoke('ready')).code,200); assert.equal(row.merchant_status,'ready');
  console.log('PASS: merchant isolation, Admin review preserved, four statuses, legacy acceptance, customer-specific ready push, duplicate/concurrent decisions and provider failure.');
})().catch(error=>{console.error(error);process.exitCode=1;});
