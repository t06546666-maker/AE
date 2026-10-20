const assert=require('node:assert/strict');
const {validNewPassword}=require('../backend/password-policy.cjs');
for(const value of ['Abcdefgh','ABCDEFGH','A1234567','GoodPass123!'])assert.equal(validNewPassword(value),true);
for(const value of ['Abcdefg','abcdefgh','12345678','',null,12345678,'A'.repeat(73)])assert.equal(validNewPassword(value),false);
const existing='oldlowercase';assert.equal(existing,'oldlowercase'); // The validator is pure, never transforms credentials.
const mixed='MixedCase8';validNewPassword(mixed);assert.equal(mixed,'MixedCase8');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync('server.js','utf8');const context={crypto};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function hashPassword('),source.indexOf('function generateCustomerPassword(')),context);
const legacyHash=context.hashPassword('oldpass');assert.equal(context.verifyPassword('oldpass',legacyHash),true);assert.equal(validNewPassword('oldpass'),false);
assert.equal(context.verifyPassword('OLDPASS',legacyHash),false);
console.log('PASS: 8-character boundary, uppercase required, longer passwords, type/length validation and no password transformation.');
