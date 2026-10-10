const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('server.js','utf8');
const definition=source.match(/function calculateFixedPurchasePoints\([^]*?\n\}/)[0];
const calculate=new Function(definition+';return calculateFixedPurchasePoints;')();
for(const [amount,points] of [[0,0],[.99,0],[1,1],[9,1],[9.99,1],[10,2],[49.99,2],[50,5],[99.99,5],[100,10],[10000,100]])assert.equal(calculate(amount,10),points);
assert.equal(calculate(NaN),0);
for(const path of ['src/pages/AddCustomer.tsx','src/components/QrScanner.tsx'])assert.ok(fs.readFileSync(path,'utf8').includes('eligibleAmount < 1 ? 0 : eligibleAmount < 10 ? 1 :'));
console.log('PASS: small-purchase point tiers and boundaries, zero rejection, and 100-point cap');
