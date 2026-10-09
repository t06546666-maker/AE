const assert = require('node:assert/strict');
const fs = require('node:fs');
const en = require('../../backend/locales/en.json');
const ml = require('../../backend/locales/ml.json');
for (const pack of [en, ml]) {
  for (const [key, value] of Object.entries(pack)) {
    assert.ok(!['__proto__', 'constructor', 'prototype'].includes(key));
    assert.equal(typeof value, 'string');
    assert.ok(value.trim(), `Empty translation: ${key}`);
  }
}
for (const phrase of ['Merchant request', 'Usual route visit', 'Pending', 'Solved', 'Escalated to admin team', 'Follow-up required', 'Merchant feedback *']) {
  assert.ok(/[\u0d00-\u0d7f]/.test(ml['ui.' + phrase]), `Missing Malayalam: ${phrase}`);
}
for (const ad of require('../../backend/customer-ads.json')) {
  if (!ad.imageUrls) continue;
  for (const locale of ['en', 'ml']) {
    const url = new URL(ad.imageUrls[locale]);
    assert.ok(fs.existsSync('public' + url.pathname), `Missing ${locale} image`);
  }
  assert.notEqual(ad.imageUrls.en, ad.imageUrls.ml);
}
console.log('PASS: language pack validation, visit statuses, and separate language images');
