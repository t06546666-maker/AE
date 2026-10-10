const fs=require('node:fs');
const assert=require('node:assert/strict');
const server=fs.readFileSync('server.js','utf8');
for(const endpoint of ['/api/admin/customers','/api/admin/customers/:id/details','/api/admin/customers/:id/activity','/api/admin/field-managers/:id/records']) {
 const start=server.indexOf(`app.get('${endpoint}'`);assert.ok(start>=0,endpoint);
 const route=server.slice(start,server.indexOf('\n});',start)+4);
 assert.ok(/requireRole\('admin'\)/.test(route),`${endpoint}: admin only`);
 if(endpoint.endsWith('/activity'))assert.ok(route.includes("eq('customer_id',req.params.id)"));
 if(endpoint.endsWith('/records')) {assert.ok(route.includes("eq('manager_id',req.params.id)"));assert.ok(route.includes('password|token|secret|credential'));}
 if(!endpoint.endsWith('/details'))assert.ok(route.includes('range(paging.from,paging.to)'));
}
const customer=fs.readFileSync('src/pages/AdminCustomers.tsx','utf8');
assert.ok(customer.includes('Source not recorded'));
assert.ok(!customer.includes('maskedPhone'));
console.log('PASS: admin-only paginated directories, scoped histories and explicit unknown onboarding source (source-level checks)');
