const assert=require('node:assert/strict');
const fs=require('node:fs');
const server=fs.readFileSync('server.js','utf8');
assert.ok(!server.includes('original(maskCustomerResponse(body))'),'Do not mask names in authorised merchant responses');
assert.ok(server.includes("'/api/merchant/loyal-customers','/api/checkouts','/api/redemptions'], requireAuth)"),'Keep authentication on the same endpoint group');
for(const file of ['Customers.tsx','Orders.tsx','AddCustomer.tsx','MerchantOverview.tsx']) {
  const source=fs.readFileSync('src/pages/'+file,'utf8');
  assert.ok(source.includes('maskedPhone('),file+' must retain phone masking');
}
const {maskCustomerName}=require('../backend/customer-name-mask.cjs');
assert.equal(maskCustomerName('Safar Ali'),'S*** A***','Unused legacy helper must not be altered to affect other consumers');
console.log('PASS: merchant response name masking removed; endpoint authentication and phone masking preserved');
