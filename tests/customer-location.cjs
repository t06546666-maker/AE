const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('server.js', 'utf8');
let route = source.slice(source.indexOf("app.get('/api/customer/merchants'"));
route = route.slice(0, route.indexOf('\n});') + 4);
const rows = [
  { id: 'far', name: 'Far shop', latitude: 11, longitude: 76, route_name: 'Chittur 1', created_at: '2026-10-08' },
  { id: 'near', name: 'Near shop', latitude: 10.001, longitude: 76, route_name: 'Chittur 2', created_at: '2026-10-07' },
  { id: 'unknown', name: 'No coordinates', latitude: null, longitude: null, route_name: 'Thathamangalam 1' },
];
let handler;
const query = { from: 0, to: 999, allowedRoutes: null, select() { return this; }, eq() { return this; }, in(_field, routes) { this.allowedRoutes = routes; return this; }, or() { return this; }, order() { return this; }, range(from, to) { this.from = from; this.to = to; return this; }, then(resolve) { const matches = this.allowedRoutes ? rows.filter(row => this.allowedRoutes.includes(row.route_name)) : rows; return Promise.resolve({ data: matches.slice(this.from, this.to + 1), count: matches.length, error: null }).then(resolve); } };
new Function('app', 'requireCustomerAuth', 'paginationFromRequest', 'supabaseAdmin', 'paginationMeta', route)(
  { get: (_path, _auth, callback) => { handler = callback; } }, () => {},
  () => ({ enabled: true, from: 0, to: 1, search: '' }), { from: () => { query.allowedRoutes = null; query.from = 0; query.to = 999; return query; } }, (_paging, total) => ({ total }),
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
  assert.deepEqual((await request({ routeGroup: 'chittur' })).merchants.map(m => m.id), ['far', 'near']);
  assert.deepEqual((await request({ routeGroup: 'thathamangalam' })).merchants.map(m => m.id), ['unknown']);
  assert.deepEqual((await request({ routeGroup: 'all' })).merchants.map(m => m.id), ['far', 'near']);
  assert.equal((await request({ routeGroup: 'other' })).error, 'Select a valid shopping area.');
  console.log('Passed: route-group filtering and GPS nearest-first sorting with missing/invalid GPS fallback.');
})().catch(error => { console.error(error); process.exitCode = 1; });
