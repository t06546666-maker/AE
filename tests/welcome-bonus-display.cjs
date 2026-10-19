const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { customerWelcomeBonusActivity } = require('../backend/welcome-bonus-display.cjs');
const bonus = { customer_id: 'customer-a', points: 200, created_at: '2026-10-01T00:00:00Z', merchants: { name: 'Must not appear shop' } };
const formatted = customerWelcomeBonusActivity(bonus);
assert.equal(formatted.merchant_name, 'Welcome bonus');
assert.equal(formatted.source, 'system');
assert.equal(formatted.bonus_kind, 'welcome');
assert.equal(formatted.points, 200);
assert.equal(formatted.amount, null);
assert(!JSON.stringify(formatted).includes('Must not appear shop'));
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'server.js'), 'utf8');
const routes = {};
const fixtures = {
  orders: [{ id: 'purchase-a', created_at: '2026-10-02T00:00:00Z', points_earned: 10, amount: 100, merchants: { name: 'Actual purchase shop' } }],
  point_redemptions: [], loyalty_bonuses: [], customer_onboarding_bonuses: [bonus], admin_customer_point_grants: [],
};
function queryFor(table) {
  let head = false;
  const query = {
    select(fields, options) { head = !!options?.head; if (table === 'customer_onboarding_bonuses') assert(!fields.includes('merchants(')); return this; },
    eq() { return this; }, order() { return this; }, limit() { return this; },
    then(resolve, reject) { return Promise.resolve(head ? { count: 1 } : { data: fixtures[table] || [] }).then(resolve, reject); },
  };
  return query;
}
const context = { app: { get(path, auth, handler) { routes[path] = handler; } }, requireCustomerAuth() {}, customerWelcomeBonusActivity,
  supabaseAdmin: { from: queryFor }, paginationFromRequest: () => ({ enabled: false }), paginationMeta: (_paging, total) => ({ total }), console,
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf("app.get('/api/customer/dashboard',"), source.indexOf('const DEFAULT_MERCHANT_CATEGORIES')), context);
function response() { return { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
(async () => {
  for (const path of ['/api/customer/dashboard', '/api/customer/transactions']) {
    const res = response();
    await routes[path]({ customer: { id: 'customer-a', reward_points: 210 } }, res);
    assert.equal(res.code, 200);
    const items = res.body.activity || res.body.transactions;
    const welcome = items.filter(item => item.bonus_kind === 'welcome');
    assert.equal(welcome.length, 1); assert.equal(welcome[0].points, 200);
    assert.equal(welcome[0].merchant_name, 'Welcome bonus');
    assert.equal(items.find(item => item.type === 'earn').merchant_name, 'Actual purchase shop');
    if (res.body.summary) { assert.equal(res.body.summary.welcome_bonus_points, 200); assert.equal(res.body.summary.total_earned, 210); }
  }
  const merchantContext = { app: { get(path, auth, handler) { routes[path] = handler; } }, requireAuth() {}, console,
    supabaseAdmin: {
      rpc: async () => ({ data: { balance: 1500, carriedForward: null, events: [] } }),
      from(name) { assert.equal(name, 'merchant_onboarding_bonuses'); return {
        select(fields) { assert.equal(fields, 'points,created_at'); return this; },
        eq(field, value) { assert.equal(field, 'merchant_id'); assert.equal(value, 'merchant-a'); return this; },
        async maybeSingle() { return { data: { points: 2000, created_at: '2026-10-01T00:00:00Z' } }; },
      }; },
    },
  };
  vm.createContext(merchantContext);
  vm.runInContext(source.slice(source.indexOf("app.get('/api/merchants/:id/point-insights',"), source.indexOf("app.post('/api/merchants/:id/point-allocation',")), merchantContext);
  const merchantResponse = response();
  await routes['/api/merchants/:id/point-insights']({ params: { id: 'merchant-a' }, query: { from: '2026-10-01', to: '2026-10-02' }, auth: { profile: { role: 'merchant', merchant_id: 'merchant-a' } } }, merchantResponse);
  assert.equal(merchantResponse.code, 200);
  assert.equal(merchantResponse.body.balance, 1500, 'displaying historical welcome points must not add them to balance again');
  assert.equal(merchantResponse.body.welcomeBonus.points, 2000); assert.equal(merchantResponse.body.welcomeBonus.source, 'system');
  const denied = response();
  await routes['/api/merchants/:id/point-insights']({ params: { id: 'other' }, auth: { profile: { role: 'merchant', merchant_id: 'merchant-a' } } }, denied);
  assert.equal(denied.code, 403);
  const sql = fs.readFileSync(require('node:path').join(__dirname, '..', 'supabase-onboarding-welcome-bonuses.sql'), 'utf8');
  assert.match(sql, /merchant_id uuid primary key/); assert.match(sql, /customer_id uuid primary key/);
  assert.match(sql, /values\(p_merchant_id,2000\)/); assert.match(sql, /values\(p_customer_id,p_merchant_id,200\)/);
  assert.match(sql, /if found then return current_balance; end if/);
  assert.match(sql, /'awarded',false/);
  console.log('PASS: system welcome labels, no merchant attribution, unchanged purchase names, exactly-once display and summary totals, 200/2000 one-time source guards.');
})().catch(error => { console.error(error); process.exitCode = 1; });
