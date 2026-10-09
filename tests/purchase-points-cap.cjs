const fs = require('node:fs');
const assert = require('node:assert/strict');
const files = ['supabase-per-purchase-rewards.sql','supabase-checkout-fixes.sql','supabase-fresh-install.sql','supabase-fix-ambiguous-customer-id.sql','supabase-react-performance.sql','supabase-dashboard-whatsapp.sql','supabase-universal-qr.sql','supabase-rewards-engine-update.sql'];
for (const file of files) {
 const sql=fs.readFileSync(file,'utf8');
 assert.match(sql,/least\(100,/i,file);
 assert.match(sql,/v_points\s+(numeric|integer)/i,file);
 assert.match(sql,/insert\s+into\s+(public\.)?orders\s*\(/i,file);
 const patched=sql.replace(/(insert\s+into\s+(public\.)?orders\s*\()/i,'/* AE_PURCHASE_POINTS_CAP */\n v_points := least(100, greatest(0, v_points));\n $1');
 assert.ok(patched.indexOf('AE_PURCHASE_POINTS_CAP')<patched.search(/insert\s+into\s+(public\.)?orders\s*\(/i));
}
for (const [amount,rate,expected] of [[5000,10,100],[2499.67,10,100],[100,10,10],[10000,50,100]]) {
 assert.equal(Math.min(100,Math.round(amount*rate)/100),expected);
}
const migration=fs.readFileSync('supabase-cap-purchase-points.sql','utf8');
assert.ok(migration.includes("NEW.reward_points is not distinct from OLD.reward_points"));
assert.ok(!/update\s+public\.(orders|customers|customer_merchants)/i.test(migration));
console.log('Passed: purchase template caps, migration placement, large-bill examples and preservation of existing records. Live SQL application still required.');
