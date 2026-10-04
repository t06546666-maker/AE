const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('server.js', 'utf8');
const offers = [
  { id: 'public', audience: 'all', merchant_id: 'a' },
  { id: 'eligible', audience: 'loyal', merchant_id: 'a' },
  { id: 'ineligible', audience: 'loyal', merchant_id: 'b' },
];
let handler;
let calls = [];
const db = { from(table) {
  const filters = {};
  const query = { select() { return this; }, eq(k,v) { filters[k]=v; return this; }, gt() { return this; }, order() { return this; }, limit() { return this; }, then(resolve) {
    if (table === 'orders') { assert.equal(filters.customer_id, 'signed-in-customer'); calls.push(filters.merchant_id); resolve({ count: filters.merchant_id === 'a' ? 5 : 4 }); }
    else resolve({ data: offers });
  } };
  return query;
} };
const start = source.indexOf("app.get('/api/customer/offers'");
const end = source.indexOf("app.post('/api/customer/notifications/test'", start);
vm.runInNewContext(source.slice(start, end), { app: { get(_path,_auth,fn) { handler=fn; } }, requireCustomerAuth() {}, supabaseAdmin: db, signedOfferImageUrl: async()=>'', Date, Set });
(async()=>{
  let payload;
  await handler({ customer: { id:'signed-in-customer' } }, { json(value) { payload=value; }, status() { return this; } });
  assert.deepEqual(Array.from(payload.offers, o=>o.id), ['public','eligible']);
  assert.deepEqual(calls, ['a','b']);
  const sql=fs.readFileSync('supabase-loyalty.sql','utf8');
  assert.match(sql,/purchase_count<5/);
  assert.match(sql,/p_points>100/);
  assert.match(sql,/unique \(merchant_id, request_id\)/);
  assert.match(sql,/for update/);
  assert.match(sql,/selected_offer\.audience = 'all' or/);
  assert.match(sql,/revoke all on function public\.award_loyalty_bonus/);
  assert.doesNotMatch(sql,/insert into (?:public\.)?orders/i);
  console.log('PASS: loyal offers visible at 5 purchases, hidden at 4, merchant-specific and authenticated customer-specific; migration guard checks passed. SQL execution still requires Supabase.');
})().catch(error=>{ console.error(error); process.exitCode=1; });
