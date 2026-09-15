// Run with --no-experimental-require-module to reproduce restricted server runtimes.
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
require('firebase-admin/auth');
require('firebase-admin/messaging');
const { retrieveSigningKeys } = require('jwks-rsa/src/utils');

async function main() {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keys = await retrieveSigningKeys([
    { ...publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256' },
  ]);
  assert.equal(keys.length, 1);
  assert.equal(keys[0].getPublicKey(), publicKey.export({ format: 'pem', type: 'spki' }));
  console.log('PASS: Firebase imports and RSA signing-key conversion');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
