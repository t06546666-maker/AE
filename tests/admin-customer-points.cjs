const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('server.js', 'utf8');
const sql = fs.readFileSync('supabase-admin-customer-point-grants.sql', 'utf8');
const page = fs.readFileSync('src/pages/AdminCustomers.tsx', 'utf8');
const activity = fs.readFileSync('src/pages/customer/Notifications.tsx', 'utf8');

assert(server.includes("app.post('/api/admin/customers/award-points', requireAuth, requireRole('admin'"));
assert(server.includes("rpc('admin_grant_customer_points'"));
assert(server.includes("'admin_points_grant'"));
assert(sql.includes('unique (customer_id, request_id)'));
assert(sql.includes('admin_customer_point_grant_batches'));
assert(sql.includes('update public.customers set reward_points=coalesce(reward_points,0)+p_points'));
assert(sql.includes('update public.customer_merchants set reward_points=coalesce(reward_points,0)+p_points'));
assert(sql.includes('grant execute on function public.admin_grant_customer_points'));
assert(page.includes("'/api/admin/customers/award-points'"));
assert(page.includes('Select up to 1,000 customers per grant.'));
assert(activity.includes('item.reason'));

console.log('PASS: admin-selected customer grants are role-restricted, audited, idempotent, and notify customers.');
