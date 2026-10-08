const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('server.js', 'utf8');
let route = source.slice(source.indexOf("app.get('/api/customer/merchants'"));
route = route.slice(0, route.indexOf('\n});') + 4);
const rows = [
  { id: 'far', name: 'Far shop', latitude: 11, longitude: 76, created_at: '2026-10-08' },
  { id: 'near', name: 'Near shop', latitude: 10.001, longitude: 76, created_at: '2026-10-07' },
  { id: 'unknown', name: 'No coordinates', latitude: null, longitude: null },
];
let handler;
const query = { from: 0, to: 999, select() { return this; }, eq() { return this; }, or() { return this; }, order() { return this; }, range(from, to) { this.from = from; this.to = to; return this; }, then(resolve) { return Promise.resolve({ data: rows.slice(this.from, this.to + 1), count: rows.length, error: null }).then(resolve); } };
new Function('app', 'requireCustomerAuth', 'paginationFromRequest', 'supabaseAdmin', 'paginationMeta', route)(
  { get: (_path, _auth, callback) => { handler = callback; } }, () => {},
  () => ({ enabled: true, from: 0, to: 1, search: '' }), { from: () => query }, (_paging, total) => ({ total }),
);
async function request(params) {
  let body;
  await handler({ query: params }, { json: value => { body = value; }, status() { return this; } });
  return body;
}
(async () => {
  const nearby = await request({ latitude: '10', longitude: '76' });
  assert.deepEqual(nearby.merchants.map(m => m.id), ['near', 'far']);
  assert.equal(nearby.pagination.total, 3);
  assert.deepEqual((await request({})).merchants.map(m => m.id), ['far', 'near']);
  assert.deepEqual((await request({ latitude: '999', longitude: '76' })).merchants.map(m => m.id), ['far', 'near']);
  console.log('Passed: GPS nearest-first sorting before pagination, missing/invalid GPS fallback.');
})().catch(error => { console.error(error); process.exitCode = 1; });
