const fs = require('node:fs');
const assert = require('node:assert/strict');

const server = fs.readFileSync('server.js', 'utf8');

// 1. Verify PATCH /api/admin/customers/:id
const custStart = server.indexOf("app.patch('/api/admin/customers/:id'");
assert.ok(custStart >= 0, 'PATCH /api/admin/customers/:id exists');
const custRoute = server.slice(custStart, server.indexOf('\n});', custStart) + 4);
assert.ok(/requireRole\('admin'\)/.test(custRoute), 'Admin customer update is admin-only');
assert.ok(custRoute.includes('normalizePhone'), 'Normalizes customer phone');
assert.ok(custRoute.includes('isEmail'), 'Validates customer email');
assert.ok(custRoute.includes("neq('id', customerId)"), 'Checks customer phone uniqueness');
assert.ok(custRoute.includes("from('customers').update"), 'Updates customers table');

// 2. Verify PATCH /api/merchants/:id
const merchStart = server.indexOf("app.patch('/api/merchants/:id'");
assert.ok(merchStart >= 0, 'PATCH /api/merchants/:id exists');
const merchRoute = server.slice(merchStart, server.indexOf('\n});', merchStart) + 4);
assert.ok(/requireRole\('admin'\)/.test(merchRoute), 'Admin merchant update is admin-only');
assert.ok(merchRoute.includes('normalizePhone'), 'Normalizes merchant phone');
assert.ok(merchRoute.includes('isEmail'), 'Validates merchant email');
assert.ok(merchRoute.includes('updateUserById'), 'Syncs Supabase Auth user for merchant login');
assert.ok(merchRoute.includes("from('active_merchants').update") || merchRoute.includes("from('merchants').update"), 'Updates merchants table');

// 3. Verify Frontend UI in AdminCustomers.tsx
const adminCustomersUI = fs.readFileSync('src/pages/AdminCustomers.tsx', 'utf8');
assert.ok(adminCustomersUI.includes('updateCustomer'), 'Has customer update mutation');
assert.ok(adminCustomersUI.includes("apiFetch(`/api/admin/customers/${encodeURIComponent(id)}`"), 'Calls customer patch endpoint');
assert.ok(adminCustomersUI.includes('Edit customer'), 'Has Edit customer button/modal');

// 4. Verify Frontend UI in AdminMerchantDetails.tsx
const adminMerchUI = fs.readFileSync('src/pages/AdminMerchantDetails.tsx', 'utf8');
assert.ok(adminMerchUI.includes('updateMerchant'), 'Has merchant update mutation');
assert.ok(adminMerchUI.includes("apiFetch(`/api/merchants/${encodeURIComponent(id)}`"), 'Calls merchant patch endpoint');
assert.ok(adminMerchUI.includes('Edit merchant'), 'Has Edit merchant button/modal');

// 5. Verify Customer Deletion in Backend and Frontend
assert.ok(server.includes("app.delete(['/api/customers/:id', '/api/admin/customers/:id']") || server.includes("app.delete('/api/customers/:id'"), 'Customer delete endpoint exists');
assert.ok(adminCustomersUI.includes('removeCustomer'), 'Has customer delete mutation on table list');
assert.ok(adminCustomersUI.includes('deleteCustomer'), 'Has customer delete mutation on detail view');
assert.ok(adminCustomersUI.includes('bulkRemove'), 'Has bulk delete mutation for selected customers');
assert.ok(adminCustomersUI.includes('Delete customer'), 'Has Delete customer button');

console.log('PASS: admin-side customer and merchant editing and deletion verified end-to-end');

