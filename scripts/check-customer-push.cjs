const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const server = fs.readFileSync(require('node:path').join(__dirname, '..', 'server.js'), 'utf8');
const start = server.indexOf('async function pushToCustomer(');
const end = server.indexOf('async function getMerchantEarnRateWithCap(', start);
assert(start > 0 && end > start);
const documents = new Map();
const sent = [];
const sandbox = {
  console, firebaseInitializationPromise: Promise.resolve(), firebaseInitialized: true,
  sendPushNotification: async (...args) => { sent.push(args); return true; },
  loadFirebase: async () => ({
    FieldValue: { serverTimestamp: () => 'server-time' },
    getFirestore: () => ({ collection: name => {
      assert.equal(name, 'ae_customer_notifications');
      return { doc: id => ({
        get: async () => ({ data: () => documents.get(id) }),
        set: async (data, options) => { assert.equal(options.merge, true); documents.set(id, { ...documents.get(id), ...data }); },
      }) };
    } }),
  }),
};
vm.createContext(sandbox);
vm.runInContext(server.slice(start, end).replaceAll("import('firebase-admin/firestore')", "loadFirebase()"), sandbox);
(async () => {
  assert.equal(await sandbox.pushToCustomer('customer-a', 'Title', 'Body'), false);
  await sandbox.saveCustomerPushTarget('customer-a', { push_token: 'test-token', push_enabled: true });
  assert.equal(await sandbox.pushToCustomer('customer-a', 'Title', 'Body'), true);
  assert.equal(sent[0][0], 'test-token');
  assert.equal(await sandbox.pushToCustomer('customer-b', 'Title', 'Body'), false);
  await sandbox.saveCustomerPushTarget('customer-a', { push_enabled: false });
  assert.equal(await sandbox.pushToCustomer('customer-a', 'Title', 'Body'), false);
  assert.equal(sent.length, 1);
  assert.equal(documents.get('customer-a').push_token, 'test-token');
  sandbox.firebaseInitialized = false;
  await assert.rejects(sandbox.getCustomerPushTarget('customer-a'), /not configured/);
  console.log('PASS: Firestore customer routing, identity isolation, opt-out, merge and missing configuration; no Supabase dependency in routing.');
})().catch(error => { console.error(error); process.exitCode = 1; });
