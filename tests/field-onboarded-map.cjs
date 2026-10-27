const assert = require('node:assert/strict');
const express = require('express');
const { coordinate, mapOnboardedMerchants, readOnboardedMerchants, registerFieldOnboardingMaps } = require('../backend/field-onboarded-merchants.cjs');

const manager = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
assert.equal(coordinate('', 90), null);
assert.equal(coordinate(false, 90), null);
assert.equal(coordinate(91, 90), null);
assert.equal(coordinate(0, 90), 0);
const first = '2026-10-20T10:00:00Z', later = '2026-10-21T10:00:00Z';
const mapped = mapOnboardedMerchants([
  { merchant_id: 'a', created_at: later }, { merchant_id: 'a', created_at: first },
  { merchant_id: 'b', created_at: first }, { merchant_id: null, created_at: first },
], [
  { id: 'a', name: '<Shop>', merchant_code: 'A', latitude: '10.5', longitude: '76.5', password_hash: 'never-return', email: 'private@example.test' },
  { id: 'b', name: 'Missing GPS', latitude: '', longitude: 76 },
  { id: 'unrelated', name: 'Another manager', latitude: 10, longitude: 76 },
]);
assert.equal(mapped.merchants.length, 2);
assert.equal(mapped.merchants[0].onboarded_at, first);
assert.equal(mapped.merchants[0].latitude, 10.5);
assert.equal(mapped.merchants[1].longitude, null);
assert.equal(mapped.missingLocations, 1);
assert.ok(!JSON.stringify(mapped).includes('never-return'));
assert.ok(!JSON.stringify(mapped).includes('private@example.test'));

let fail = false, records = [], merchants = [], calls = [];
const db = { from(table) {
  const filters = {}, call = { table, filters }; calls.push(call);
  const query = {
    select(fields) { call.fields = fields; return this; },
    eq(key, value) { filters[key] = value; return this; },
    order() { return this; },
    async range(from, to) {
      if (fail) return { error: { message: 'offline' } };
      assert.equal(filters.status, 'approved');
      assert.equal(filters['payload->>action'], 'onboard_merchant');
      return { data: records.filter(row => row.manager_id === filters.manager_id).slice(from, to + 1) };
    },
    async in(key, ids) { assert.equal(key, 'id'); assert.ok(ids.length <= 100); return { data: merchants.filter(row => ids.includes(row.id)) }; },
    async maybeSingle() { assert.equal(filters.role, 'field_manager'); return { data: filters.id === manager ? { id: manager } : null }; },
  };
  return query;
} };

(async () => {
  records = Array.from({ length: 501 }, (_, index) => ({ id: `record-${index}`, merchant_id: `shop-${index}`, manager_id: manager, created_at: first }));
  merchants = records.map(row => ({ id: row.merchant_id, name: row.merchant_id, merchant_code: row.merchant_id, latitude: 10, longitude: 76 }));
  assert.equal((await readOnboardedMerchants(db, manager)).merchants.length, 501, 'must load beyond a single database page');
  assert.equal(calls.filter(call => call.table === 'field_manager_merchant_updates').length, 2);
  assert.equal(calls.filter(call => call.table === 'active_merchants').length, 6);

  const auth = (req, res, next) => {
    const role = req.headers.authorization;
    if (!['field_manager', 'admin'].includes(role)) return res.sendStatus(401);
    req.auth = { profile: { id: manager, role } }; next();
  };
  const role = expected => (req, res, next) => req.auth.profile.role === expected ? next() : res.sendStatus(403);
  const app = express();
  registerFieldOnboardingMaps(app, { auth, fieldRole: role('field_manager'), adminRole: role('admin'), db });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/field/onboarded-merchants`)).status, 401);
    assert.equal((await fetch(`${base}/api/admin/field-managers/${manager}/onboarded-merchants`, { headers: { authorization: 'field_manager' } })).status, 403);
    calls = [];
    const response = await fetch(`${base}/api/field/onboarded-merchants?managerId=${other}`, { headers: { authorization: 'field_manager' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).merchants.length, 501);
    assert.ok(calls.filter(call => call.table === 'field_manager_merchant_updates').every(call => call.filters.manager_id === manager), 'browser-supplied manager ID must be ignored');
    assert.equal((await fetch(`${base}/api/admin/field-managers/${other}/onboarded-merchants`, { headers: { authorization: 'admin' } })).status, 404);
    assert.equal((await fetch(`${base}/api/admin/field-managers/not-an-id/onboarded-merchants`, { headers: { authorization: 'admin' } })).status, 400);
    assert.equal((await fetch(`${base}/api/admin/field-managers/${manager}/onboarded-merchants`, { headers: { authorization: 'admin' } })).status, 200);
    fail = true;
    assert.equal((await fetch(`${base}/api/field/onboarded-merchants`, { headers: { authorization: 'field_manager' } })).status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('PASS: saved shop coordinates, missing GPS, deduplication, private-field exclusion, complete pagination, authenticated manager scope, admin-only selected-manager lookup and database failure handling. Synthetic local records only.');
})().catch(error => { console.error(error); process.exitCode = 1; });

