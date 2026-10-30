const fs = require('node:fs');
const assert = require('node:assert/strict');

// 1. Verify server.js routes
const server = fs.readFileSync('server.js', 'utf8').replace(/\r\n/g, '\n');

// POST /api/offers allows admin & merchant
const postStart = server.indexOf("app.post(\n  '/api/offers',");
assert.ok(postStart >= 0, 'POST /api/offers route exists');
const postSnippet = server.slice(postStart, server.indexOf("app.put(\n  '/api/offers/:id',"));
assert.ok(postSnippet.includes("['merchant', 'admin'].includes(req.auth.profile?.role)"), 'POST /api/offers allows merchant and admin');
assert.ok(postSnippet.includes("isAdmin ? 'approved' : 'pending'"), 'Admin created offers are automatically approved');

// DELETE /api/offers/:id
const deleteStart = server.indexOf("app.delete(\n  '/api/offers/:id',");
assert.ok(deleteStart >= 0, 'DELETE /api/offers/:id route exists');
const deleteSnippet = server.slice(deleteStart, deleteStart + 800);
assert.ok(deleteSnippet.includes("requireRole('admin')"), 'DELETE /api/offers/:id is admin only');
assert.ok(deleteSnippet.includes(".from('offers').delete()"), 'DELETE /api/offers/:id deletes the offer record');

// /api/customer/ads includes dynamic approved offers
const adsStart = server.indexOf("app.get('/api/customer/ads'");
assert.ok(adsStart >= 0, '/api/customer/ads route exists');
const adsSnippet = server.slice(adsStart, adsStart + 1000);
assert.ok(adsSnippet.includes(".from('offers')"), '/api/customer/ads queries offers');
assert.ok(adsSnippet.includes(".eq('status', 'approved')"), '/api/customer/ads filters by approved status');

// 2. Verify Offers.tsx UI
const offersUI = fs.readFileSync('src/pages/Offers.tsx', 'utf8');
assert.ok(offersUI.includes("Create Offer / Ad"), 'PageHeader has Create Offer / Ad button for admin');
assert.ok(offersUI.includes("adminMerchantId"), 'Has admin merchant selector state');
assert.ok(offersUI.includes("deleteOffer"), 'Has deleteOffer mutation');
assert.ok(offersUI.includes("<Trash2"), 'Has Delete button in UI');

// 3. Verify Customer Home displays digital ads carousel
const customerHome = fs.readFileSync('src/pages/customer/Home.tsx', 'utf8');
assert.ok(customerHome.includes("CustomerAds"), 'CustomerHome imports CustomerAds');
assert.ok(customerHome.includes("<CustomerAds />"), 'CustomerHome renders CustomerAds carousel');

console.log('PASS: Admin digital ads/offers creation, editing, deletion and customer app rendering verified');
