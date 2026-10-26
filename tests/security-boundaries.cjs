const assert = require('node:assert/strict');
const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const { securityHeaders } = require('../backend/security-headers.cjs');

(async () => {
  const app = express();
  app.use(securityHeaders);
  app.use(express.json());
  app.use('/api/payments', require('../src/modules/affiliate/payments'));
  app.get('/api/private', (_req, res) => res.json({ ok: true }));
  app.get('/', (_req, res) => res.send('AE'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const callback = await fetch(`${base}/api/payments/callbacks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction_id: 'fake-instruction', status: 'SUCCESS' }),
    });
    assert.equal(callback.status, 410, 'unsigned mock callbacks must not record payment success');
    const response = await fetch(`${base}/api/private`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    const page = await fetch(base);
    assert.equal(page.status, 200);
    const source = fs.readFileSync('server.js', 'utf8');
    const scope = { crypto, Buffer };
    vm.createContext(scope);
    vm.runInContext(source.slice(source.indexOf('function hashPassword('), source.indexOf('function generateCustomerPassword(')), scope);
    const hash = scope.hashPassword('ExistingPassword1');
    assert.equal(scope.verifyPassword('ExistingPassword1', hash), true);
    assert.equal(scope.verifyPassword('WrongPassword1', hash), false);
    assert.equal(scope.verifyPassword('ExistingPassword1', 'salt:invalid'), false);
    console.log('PASS: unsigned mock callback blocked; API no-store and framing/MIME protections; existing password hashes still authenticate. Local test only.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
