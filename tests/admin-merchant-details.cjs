const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('server.js','utf8');
for(const route of ['/api/admin/merchants/:id/details','/api/admin/merchants/:id/activity']) {
 assert.ok(source.includes(`app.get('${route}',requireAuth,requireRole('admin')`));
}
const activity=source.slice(source.indexOf("app.get('/api/admin/merchants/:id/activity'"),source.indexOf("app.get('/api/admin/merchants/:id/records'"));
assert.ok(activity.includes(".eq('merchant_id',req.params.id)"));
assert.ok(activity.includes('query.range(paging.from,paging.to)'));
assert.ok(activity.includes(".eq('customer_id',String(req.query.customerId))"));
console.log('PASS: admin-only endpoints, merchant/customer scope and paginated records');
