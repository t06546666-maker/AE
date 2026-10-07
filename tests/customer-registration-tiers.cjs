const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('src/pages/AddCustomer.tsx', 'utf8');
const expression = source.match(/const points = ([^;]+);/)[1];
const preview = new Function('eligibleAmount', 'percentage', `return ${expression};`);
for (const [amount, expected] of [[0,0],[9.99,0],[10,2],[49,2],[49.99,2],[50,5],[99,5],[99.99,5],[100,20],[500,100],[10000,100]]) {
  assert.equal(preview(amount, 20), expected, `purchase ${amount}`);
}
assert.match(source, /min="10" step="0.01"/);
const server = fs.readFileSync('server.js', 'utf8');
const registration = server.slice(server.indexOf("app.post('/api/customers'"), server.indexOf("app.post('/api/checkouts'"));
assert.match(registration, /amount < 10/);
assert.doesNotMatch(registration, /amount < 100/);
console.log('Customer registration tier boundaries and minimum checks passed.');
