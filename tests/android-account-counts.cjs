const assert=require('node:assert/strict');const {summarizeAndroidAccounts}=require('../backend/android-account-counts.cjs');
assert.deepEqual(summarizeAndroidAccounts([
 {role:'merchant',merchantId:'shop1',actorKey:'merchant:a',platforms:{android:true}},
 {role:'merchant',merchantId:'shop1',actorKey:'merchant:b',platforms:{android:true}},
 {role:'merchant',merchantId:'shop2',platforms:{web:true}},
 {role:'customer',actorKey:'customer:1',platforms:{android:true,web:true}},
 {role:'customer',actorKey:'customer:1',platforms:{android:true}},
 {role:'customer',actorKey:'customer:2',platforms:{web:true}},
 {role:'admin',actorKey:'admin:1',platforms:{android:true}},
 {role:'field_manager',actorKey:'field:1',platforms:{android:true}},
 {role:'merchant',platforms:{android:true}},
 {role:'customer',platforms:{android:true}},
]),{merchantAppUsers:1,customerAppUsers:1});
assert.deepEqual(summarizeAndroidAccounts([]),{merchantAppUsers:0,customerAppUsers:0});
console.log('PASS: distinct Android customers/stores; repeated sessions and profiles deduplicated; web-only, other roles and missing identities excluded');
assert.deepEqual(summarizeAndroidAccounts([{role:'merchant',merchantId:'removed',platforms:{android:true}},{role:'merchant',merchantId:'active',platforms:{android:true}},{role:'customer',actorKey:'customer:deleted',platforms:{android:true}},{role:'customer',actorKey:'customer:current',platforms:{android:true}}],{merchantIds:new Set(['active']),customerIds:new Set(['current'])}),{merchantAppUsers:1,customerAppUsers:1});
console.log('PASS: removed merchants and deleted customer accounts excluded when registry supplied');
