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

// 1. Verify schema and storage functions
const tempBannersFile = path.join(__dirname, '..', 'backend', 'ad-banners.json');
const originalContent = fs.existsSync(tempBannersFile) ? fs.readFileSync(tempBannersFile, 'utf8') : '[]';

(async () => {
  try {
    // Test local save and load
    saveLocalBanners([]);
    const empty = await loadBannersFromStorage(null);
    assert.strictEqual(Array.isArray(empty), true, 'loadBannersFromStorage should return array');

    // Test Express API integration
    const app = express();
    app.use(express.json());

    // Mock auth middlewares
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

      // 2. Create Top Banner
      const topBannerRes = await req('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Top Summer Sale',
          subtitle: 'Up to 50% discount across Chittur',
          placement: 'top',
          linkType: 'explore',
          linkValue: '',
          imageUrl: 'https://images.example.com/top-banner.jpg',
          active: true,
          displayOrder: 1,
        }),
      });
      assert.strictEqual(topBannerRes.status, 201);
      assert.strictEqual(topBannerRes.data.success, true);
      assert.strictEqual(topBannerRes.data.banner.title, 'Top Summer Sale');
      assert.strictEqual(topBannerRes.data.banner.placement, 'top');
      const topBannerId = topBannerRes.data.banner.id;

      // 3. Create Downside Banner
      const downsideBannerRes = await req('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Exclusive Merchant Deals',
          subtitle: 'Shop now and earn double points',
          placement: 'downside',
          linkType: 'merchant',
          linkValue: 'merchant-123',
          imageUrl: 'https://images.example.com/downside-banner.jpg',
          active: true,
          displayOrder: 2,
        }),
      });
      assert.strictEqual(downsideBannerRes.status, 201);
      assert.strictEqual(downsideBannerRes.data.banner.placement, 'downside');
      const downsideBannerId = downsideBannerRes.data.banner.id;

      // 4. Test customer endpoint with placement filter
      const customerAll = await req('/api/customer/banners');
      assert.strictEqual(customerAll.status, 200);
      assert.strictEqual(customerAll.data.banners.length, 2);

      const customerDownside = await req('/api/customer/banners?placement=downside');
      assert.strictEqual(customerDownside.status, 200);
      assert.strictEqual(customerDownside.data.banners.length, 1);
      assert.strictEqual(customerDownside.data.banners[0].id, downsideBannerId);
      assert.strictEqual(customerDownside.data.banners[0].placement, 'downside');

      const customerTop = await req('/api/customer/banners?placement=top');
      assert.strictEqual(customerTop.status, 200);
      assert.strictEqual(customerTop.data.banners.length, 1);
      assert.strictEqual(customerTop.data.banners[0].id, topBannerId);

      // 5. Test getActiveBannersForAds helper (merges into customer carousel ads)
      const adCarouselItems = await getActiveBannersForAds(null, null, null);
      assert.strictEqual(adCarouselItems.length, 1, 'Only top active banners appear in ad carousel');
      assert.strictEqual(adCarouselItems[0].bannerId, topBannerId);
      assert.strictEqual(adCarouselItems[0].isAdBanner, true);

      // 6. Test update (PUT)
      const updateRes = await req(`/api/admin/banners/${topBannerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Mega Summer Sale Updated',
          placement: 'top',
          subtitle: 'Updated description',
        }),
      });
      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateRes.data.banner.title, 'Mega Summer Sale Updated');

      // 7. Test toggle active (PATCH)
      const toggleRes = await req(`/api/admin/banners/${topBannerId}/toggle-active`, {
        method: 'PATCH',
      });
      assert.strictEqual(toggleRes.status, 200);
      assert.strictEqual(toggleRes.data.banner.active, false);

      // Should now be excluded from customer banners
      const customerTopAfterPause = await req('/api/customer/banners?placement=top');
      assert.strictEqual(customerTopAfterPause.data.banners.length, 0, 'Paused banners must be excluded');

      // Reactivate
      await req(`/api/admin/banners/${topBannerId}/toggle-active`, { method: 'PATCH' });
      const customerTopAfterResume = await req('/api/customer/banners?placement=top');
      assert.strictEqual(customerTopAfterResume.data.banners.length, 1, 'Re-activated banner must appear');

      // 8. Test delete
      const deleteRes = await req(`/api/admin/banners/${downsideBannerId}`, {
        method: 'DELETE',
      });
      assert.strictEqual(deleteRes.status, 200);
      assert.strictEqual(deleteRes.data.success, true);

      const customerDownsideAfterDelete = await req('/api/customer/banners?placement=downside');
      assert.strictEqual(customerDownsideAfterDelete.data.banners.length, 0);

      // Clean up remaining test banners
      await req(`/api/admin/banners/${topBannerId}`, { method: 'DELETE' });

      // Clean up server
      server.close();

      // Verify frontend files
      const adminBannersSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'AdminBanners.tsx'), 'utf8');
      assert.ok(adminBannersSource.includes('Ad Banners & Placements'), 'AdminBanners title check');
      assert.ok(adminBannersSource.includes('Downside Banner'), 'AdminBanners downside option check');
      assert.ok(adminBannersSource.includes('Top Carousel'), 'AdminBanners top carousel check');
      assert.ok(adminBannersSource.includes('toggleMutation'), 'AdminBanners status toggle check');

      const downsideCompSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'CustomerDownsideBanners.tsx'), 'utf8');
      assert.ok(downsideCompSource.includes('placement=downside'), 'CustomerDownsideBanners queries downside banners');
      assert.ok(downsideCompSource.includes('handleBannerClick'), 'CustomerDownsideBanners handles clicks');

      const homeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'customer', 'Home.tsx'), 'utf8');
      assert.ok(homeSource.includes('<CustomerDownsideBanners />'), 'CustomerHome embeds CustomerDownsideBanners');

      const layoutSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Layout.tsx'), 'utf8');
      assert.ok(layoutSource.includes('/admin/banners'), 'Layout includes /admin/banners navigation link');

      console.log('ALL AD BANNER TESTS PASSED SUCCESSFULLY!');
    } catch (err) {
      server.close();
      throw err;
    }
  } finally {
    fs.writeFileSync(tempBannersFile, originalContent, 'utf8');
  }
})();
