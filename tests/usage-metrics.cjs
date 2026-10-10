const assert=require('node:assert/strict');const {summarizeUsage}=require('../backend/usage-metrics.cjs');
const result=summarizeUsage([{actorKey:'c1',role:'customer',platforms:{web:true}},{actorKey:'c1',role:'customer',platforms:{android:true}},{actorKey:'m1',role:'merchant',merchantId:'shop1',platforms:{web:true}},{actorKey:'m2',role:'merchant',merchantId:'shop1',platforms:{android:true}}]);
assert.equal(result.activeUsers,3);assert.equal(result.activeCustomers,1);assert.equal(result.activeMerchants,1);assert.equal(result.websiteUsers,2);assert.equal(result.androidUsers,2);
console.log('PASS: deduplicated accounts across days/platforms and distinct active merchants');
