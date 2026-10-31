const fs = require('node:fs');
const assert = require('node:assert/strict');

// 1. Check server.js /api/customer/ads and /api/customer/offers
const server = fs.readFileSync('server.js', 'utf8').replace(/\r\n/g, '\n');

assert.ok(server.includes("app.get('/api/customer/ads'"), '/api/customer/ads route exists');
const adsSnippet = server.slice(server.indexOf("app.get('/api/customer/ads'"), server.indexOf("app.get('/api/customer/merchants'"));
assert.ok(adsSnippet.includes('merchants(id, name, merchant_code, phone, email, address)'), 'Ads endpoint queries merchant phone and address');
assert.ok(adsSnippet.includes('merchantPhone: phone'), 'Ads endpoint returns merchantPhone');
assert.ok(adsSnippet.includes('action: merchantName ? (phone ? `📞 ${phone}`'), 'Ads endpoint includes phone in action text for existing apps');

assert.ok(server.includes("app.get('/api/customer/offers'"), '/api/customer/offers route exists');
const offersSnippet = server.slice(server.indexOf("app.get('/api/customer/offers'"), server.indexOf("app.post('/api/customer/notifications/test'"));
assert.ok(offersSnippet.includes('merchants(id, name, merchant_code, phone, email, address)'), 'Offers endpoint queries merchant details');
assert.ok(offersSnippet.includes('merchant_phone: phone'), 'Offers endpoint maps merchant_phone');
assert.ok(offersSnippet.includes('merchant_name: `${name}${phoneTag}`'), 'Offers endpoint enriches merchant_name with phone for existing apps');

// 2. Check CustomerOfferPreviewModal
const modal = fs.readFileSync('src/components/CustomerOfferPreviewModal.tsx', 'utf8');
assert.ok(modal.includes('export function CustomerOfferPreviewModal'), 'CustomerOfferPreviewModal exported');
assert.ok(modal.includes('isZoomed'), 'Modal has zoom-in / zoom-out state');
assert.ok(modal.includes('Open in Chrome'), 'Modal has Open in Chrome button');
assert.ok(modal.includes('tel:'), 'Modal has Call Store link');
assert.ok(modal.includes('wa.me'), 'Modal has WhatsApp link');

// 3. Check CustomerAds integration
const adsUI = fs.readFileSync('src/components/CustomerAds.tsx', 'utf8');
assert.ok(adsUI.includes('CustomerOfferPreviewModal'), 'CustomerAds imports CustomerOfferPreviewModal');
assert.ok(adsUI.includes('<CustomerOfferPreviewModal'), 'CustomerAds renders preview modal');
assert.ok(adsUI.includes('openPreview'), 'CustomerAds handles click to open preview');

// 4. Check Customer Offers page integration
const offersUI = fs.readFileSync('src/pages/customer/Offers.tsx', 'utf8');
assert.ok(offersUI.includes('CustomerOfferPreviewModal'), 'Offers page imports CustomerOfferPreviewModal');
assert.ok(offersUI.includes('<CustomerOfferPreviewModal'), 'Offers page renders preview modal');
assert.ok(offersUI.includes('setSelectedOffer'), 'Offers page opens modal on card click');

// 5. Check Customer Home page integration
const homeUI = fs.readFileSync('src/pages/customer/Home.tsx', 'utf8');
assert.ok(homeUI.includes('CustomerOfferPreviewModal'), 'Home page imports CustomerOfferPreviewModal');
assert.ok(homeUI.includes('<CustomerOfferPreviewModal'), 'Home page renders preview modal');

// 6. Check Android synced assets exist
assert.ok(fs.existsSync('android/app/src/main/assets/public/index.html'), 'Android assets index.html exists');

console.log('ALL TESTS PASSED: Customer ad & offer preview mode, backend phone enrichment, and Android bundle synced successfully.');
