const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('server.js', 'utf8');
const start = source.indexOf("app.get('/api/merchants/:id/point-balance'");
const end = source.indexOf("app.get('/api/merchants/:id',", start);
const routes = {};
let credits = 0;
const context = { app: { get: (path, ...handlers) => routes[path] = handlers, post: (path, ...handlers) => routes[path] = handlers }, requireAuth() {}, requireRole: role => { assert.equal(role, 'admin'); return () => {}; }, supabaseAdmin: { rpc: async (name, args) => { assert.equal(name, 'allocate_merchant_points'); assert.equal(args.p_admin_id, 'admin-user'); credits++; return { data: 500 }; }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { point_balance: 123 } }) }) }) }) } };
vm.runInNewContext(source.slice(start, end), context);
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
(async () => {
  const allocation = routes['/api/merchants/:id/point-allocation'].at(-1);
  const id = '11111111-1111-4111-8111-111111111111';
  for (const points of [0, -1, 1.5, 1000001, '100']) {
    const res = response(); await allocation({ params: { id }, body: { points, requestId: id }, auth: { user: { id: 'admin-user' } } }, res); assert.equal(res.code, 400);
  }
  assert.equal(credits, 0);
  const res = response(); await allocation({ params: { id }, body: { points: 500, requestId: id }, auth: { user: { id: 'admin-user' } } }, res); assert.equal(res.body.balance, 500); assert.equal(credits, 1);
  const balance = routes['/api/merchants/:id/point-balance'].at(-1);
  const denied = response(); await balance({ params: { id }, auth: { profile: { role: 'merchant', merchant_id: 'other' } } }, denied); assert.equal(denied.code, 403);
  const own = response(); await balance({ params: { id }, auth: { profile: { role: 'merchant', merchant_id: id } } }, own); assert.equal(own.body.balance, 123);
  const sql = fs.readFileSync('supabase-merchant-point-allocation.sql', 'utf8');
  for (const guard of ['for update', 'request_id uuid not null unique', 'point_balance>=charge', 'before insert or update of reward_points', 'before insert on public.loyalty_bonuses', 'merchant_allocated_balance_nonnegative', "role='admin'"]) assert.ok(sql.includes(guard), guard);
  assert.ok(!source.includes('point_balance: currentPoints +'));
  console.log('Allocation API validation, merchant isolation, and SQL guard checks passed. Live SQL/concurrency tests still require migration deployment.');
})().catch(error => { console.error(error); process.exitCode = 1; });
