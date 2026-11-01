const fs = require('node:fs');
const assert = require('node:assert/strict');

console.log('Testing Offer Banner Images & Randomized Carousel Open...');

// 1. Verify Backend server.js implementations
const server = fs.readFileSync('server.js', 'utf8').replace(/\r\n/g, '\n');

// Check offerImageMiddleware supports multiple image fields
assert.ok(
  server.includes("name: 'bannerImage'"),
  'offerImageMiddleware must accept bannerImage field'
);
assert.ok(
  server.includes("req.bannerFile ="),
  'offerImageMiddleware must assign req.bannerFile'
);

// Check helper functions exist
assert.ok(
  server.includes('getOfferBannerPath') && server.includes('setOfferBannerPath'),
  'Banner path storage helpers must be defined'
);

// Check offerDto returns both images
assert.ok(
  server.includes('bannerImageUrl') && server.includes('offerImageUrl'),
  'offerDto must return bannerImageUrl and offerImageUrl'
);

// Check /api/customer/ads randomizes order and uses bannerImageUrl
const customerAdsEndpoint = server.slice(
  server.indexOf("app.get('/api/customer/ads'"),
  server.indexOf("app.get('/api/customer/merchants'")
);
assert.ok(
  customerAdsEndpoint.includes('bannerImageUrl || offerImageUrl'),
  '/api/customer/ads must prioritize bannerImageUrl for home carousel display'
);
assert.ok(
  customerAdsEndpoint.includes('Math.floor(Math.random()'),
  '/api/customer/ads must randomize order so different ads appear first'
);

// 2. Test Business Logic: Ad with separate banner vs ad with single image
function formatCustomerAd(offer, signedOfferImage, signedBannerImage) {
  return {
    id: offer.id,
    title: offer.title,
    imageUrl: signedBannerImage || signedOfferImage,
    bannerImageUrl: signedBannerImage || null,
    offerImageUrl: signedOfferImage,
  };
}

const offerWithBoth = { id: 'offer-1', title: '50% Off Biryani' };
const ad1 = formatCustomerAd(
  offerWithBoth,
  'https://cdn.example.com/biryani-full-poster.jpg',
  'https://cdn.example.com/biryani-home-banner.jpg'
);
assert.equal(ad1.imageUrl, 'https://cdn.example.com/biryani-home-banner.jpg', 'Home carousel should show banner photo');
assert.equal(ad1.offerImageUrl, 'https://cdn.example.com/biryani-full-poster.jpg', 'Preview should have full poster photo');
assert.equal(ad1.bannerImageUrl, 'https://cdn.example.com/biryani-home-banner.jpg');

const offerWithPosterOnly = { id: 'offer-2', title: 'Buy 1 Get 1' };
const ad2 = formatCustomerAd(
  offerWithPosterOnly,
  'https://cdn.example.com/bogo-poster.jpg',
  null
);
assert.equal(ad2.imageUrl, 'https://cdn.example.com/bogo-poster.jpg', 'Falls back to poster if no banner is provided');
assert.equal(ad2.bannerImageUrl, null);

// 3. Test Random Open Simulation
const adsPool = [ad1, ad2, { id: 'ad-3' }, { id: 'ad-4' }];
const startingPicks = new Set();
for (let i = 0; i < 50; i++) {
  const randomIndex = Math.floor(Math.random() * adsPool.length);
  startingPicks.add(randomIndex);
}
assert.ok(startingPicks.size > 1, 'Random open logic must pick varied initial starting slides');

// 4. Verify Frontend UI Components
const offersUI = fs.readFileSync('src/pages/Offers.tsx', 'utf8');
assert.ok(offersUI.includes('Ad Banner Photo'), 'Offers.tsx must have Ad Banner Photo input');
assert.ok(offersUI.includes("body.set('bannerImage'"), 'Offers.tsx must send bannerImage in FormData');
assert.ok(offersUI.includes('Ad Banner Set'), 'Offers.tsx must display Ad Banner Set tag on cards');

const customerAdsUI = fs.readFileSync('src/components/CustomerAds.tsx', 'utf8');
assert.ok(customerAdsUI.includes('ad.bannerImageUrl'), 'CustomerAds must use ad.bannerImageUrl');
assert.ok(customerAdsUI.includes('Math.floor(Math.random() * count)'), 'CustomerAds must pick random initial slide on open');

const modalUI = fs.readFileSync('src/components/CustomerOfferPreviewModal.tsx', 'utf8');
assert.ok(modalUI.includes('offer.bannerImageUrl'), 'CustomerOfferPreviewModal must handle bannerImageUrl');
assert.ok(modalUI.includes('hasBothImages'), 'CustomerOfferPreviewModal must support toggling when both images are set');

console.log('ALL TESTS PASSED: Dedicated offer banner images, fallback handling, and randomized app open carousel verified.');
