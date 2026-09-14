const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const middleware = source.slice(source.indexOf('async function requireCustomerAuth('), source.indexOf('\nfunction requireRole('));

test('restored customer identity retains the customer role even without a database role column', async () => {
  const context = {
    requireSupabase: () => true,
    jwt: { verify: () => ({ customerId: 'test-customer', role: 'customer' }) },
    CUSTOMER_JWT_SECRET: 'test-only',
    supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'test-customer', name: 'Test' }, error: null }) }) }) }) },
  };
  vm.createContext(context);
  vm.runInContext(middleware, context);
  const req = { headers: { authorization: 'Bearer test-token' } };
  let authenticated = false;
  const res = { status: () => { throw new Error('Unexpected authentication rejection'); } };
  await context.requireCustomerAuth(req, res, () => { authenticated = true; });
  assert.equal(authenticated, true);
  assert.equal(req.customer.role, 'customer');
  assert.equal(req.customer.id, 'test-customer');
});
