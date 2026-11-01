const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');

const {
  registerAdBanners,
  getActiveBannersForAds,
  loadBannersFromStorage,
  saveLocalBanners,
} = require('../backend/ad-banners.cjs');

console.log('Running Ad Banners test suite...');

const tempBannersFile = path.join(__dirname, '..', 'backend', 'ad-banners.json');
const originalContent = fs.existsSync(tempBannersFile) ? fs.readFileSync(tempBannersFile, 'utf8') : '[]';

(async () => {
  try {
    saveLocalBanners([]);
    const empty = await loadBannersFromStorage(null);
    assert.strictEqual(Array.isArray(empty), true, 'loadBannersFromStorage should return array');

    const app = express();
    app.use(express.json());

    const mockAuth = (req, _res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); };
    const mockAdminRole = (_req, _res, next) => next();
    const mockCustomerAuth = (req, _res, next) => { req.customer = { id: 'cust-1' }; next(); };

    registerAdBanners(app, {
      auth: mockAuth,
      adminRole: mockAdminRole,
      customerAuth: mockCustomerAuth,
      supabase: null,
      upload: null,
      bucket: null,
      signedUrlHelper: async (p) => `https://signed.example.com/${p}`,
      setOfferBannerPathHelper: async () => {},
    });

    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    async function req(path, options = {}) {
      const res = await fetch(`${baseUrl}${path}`, options);
      const data = await res.json();
      return { status: res.status, data };
    }

    try {
      // 1. Initial list
      const initial = await req('/api/admin/banners');
      assert.strictEqual(initial.status, 200);
      assert.deepStrictEqual(initial.data.banners, []);

      // 2. Create Banner linked to an Offer
      const createRes = await req('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: 'offer-xyz-123',
          merchantId: 'merchant-456',
          merchantName: 'Royal Textiles',
          title: 'Flat 30% Off Festive Collection',
          subtitle: 'Valid till Sunday',
          imageUrl: 'https://images.example.com/banner-wide.jpg',
          offerImageUrl: 'https://images.example.com/offer-poster.jpg',
          active: true,
        }),
      });
      assert.strictEqual(createRes.status, 201);
      assert.strictEqual(createRes.data.success, true);
      assert.strictEqual(createRes.data.banner.title, 'Flat 30% Off Festive Collection');
      assert.strictEqual(createRes.data.banner.merchantName, 'Royal Textiles');
      assert.strictEqual(createRes.data.banner.offerId, 'offer-xyz-123');
      const bannerId = createRes.data.banner.id;

      // 3. Test getActiveBannersForAds helper (for home carousel)
      const carouselAds = await getActiveBannersForAds(null, null, null);
      assert.strictEqual(carouselAds.length, 1);
      assert.strictEqual(carouselAds[0].bannerId, bannerId);
      assert.strictEqual(carouselAds[0].offerId, 'offer-xyz-123');
      assert.strictEqual(carouselAds[0].merchantName, 'Royal Textiles');
      assert.strictEqual(carouselAds[0].isAdBanner, true);

      // 4. Test customer banners endpoint
      const customerRes = await req('/api/customer/banners');
      assert.strictEqual(customerRes.status, 200);
      assert.strictEqual(customerRes.data.banners.length, 1);
      assert.strictEqual(customerRes.data.banners[0].id, bannerId);

      // 5. Test toggle active (PATCH)
      const toggleRes = await req(`/api/admin/banners/${bannerId}/toggle-active`, { method: 'PATCH' });
      assert.strictEqual(toggleRes.status, 200);
      assert.strictEqual(toggleRes.data.banner.active, false);

      const customerPaused = await req('/api/customer/banners');
      assert.strictEqual(customerPaused.data.banners.length, 0);

      // Re-activate
      await req(`/api/admin/banners/${bannerId}/toggle-active`, { method: 'PATCH' });
      const customerActive = await req('/api/customer/banners');
      assert.strictEqual(customerActive.data.banners.length, 1);

      // 6. Test delete
      const deleteRes = await req(`/api/admin/banners/${bannerId}`, { method: 'DELETE' });
      assert.strictEqual(deleteRes.status, 200);
      assert.strictEqual(deleteRes.data.success, true);

      const emptyAfterDelete = await req('/api/customer/banners');
      assert.strictEqual(emptyAfterDelete.data.banners.length, 0);

      server.close();

      // 7. Verify frontend file structure
      const adminSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'AdminBanners.tsx'), 'utf8');
      assert.ok(adminSource.includes('Select Merchant'), 'AdminBanners has Select Merchant');
      assert.ok(adminSource.includes('Which Offer to Give / Promote'), 'AdminBanners has Which Offer to Give / Promote');
      assert.ok(adminSource.includes('Banner Image (Optional)'), 'AdminBanners has Banner Image (Optional)');

      console.log('ALL SIMPLIFIED AD BANNER TESTS PASSED SUCCESSFULLY!');
    } catch (err) {
      server.close();
      throw err;
    }
  } finally {
    fs.writeFileSync(tempBannersFile, originalContent, 'utf8');
  }
})();
