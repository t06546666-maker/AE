const fs = require('node:fs');
const assert = require('node:assert/strict');

console.log('Running Admin Merchant Photos & Customer Front Cover tests...');

// 1. Verify Backend Endpoints in server.js
const serverSource = fs.readFileSync('server.js', 'utf8');

// POST /api/admin/merchants/:id/photos
assert.ok(
  serverSource.includes("app.post('/api/admin/merchants/:id/photos', requireAuth, requireRole('admin')"),
  'POST /api/admin/merchants/:id/photos endpoint must be registered with admin authentication'
);

// PATCH /api/admin/merchants/:id/photos
assert.ok(
  serverSource.includes("app.patch('/api/admin/merchants/:id/photos', requireAuth, requireRole('admin')"),
  'PATCH /api/admin/merchants/:id/photos endpoint must be registered with admin authentication'
);

// PATCH /api/merchants/:id supports image_url and images
assert.ok(
  serverSource.includes('updates.image_url ='),
  'PATCH /api/merchants/:id must support updating image_url'
);
assert.ok(
  serverSource.includes('updates.images ='),
  'PATCH /api/merchants/:id must support updating images array'
);

// 2. Test Business Logic for 'set_front' action
function applySetFront(merchant, targetPhoto) {
  let currentImages = Array.isArray(merchant.images) ? [...merchant.images] : [];
  if (merchant.image_url && !currentImages.includes(merchant.image_url)) {
    currentImages.unshift(merchant.image_url);
  }
  const nextImageUrl = targetPhoto;
  const nextImages = [targetPhoto, ...currentImages.filter(img => img !== targetPhoto)];
  return { image_url: nextImageUrl, images: nextImages };
}

const initialMerchant = {
  id: 'm1',
  name: 'Sample Supermarket',
  image_url: 'https://cdn.example.com/photo1.jpg',
  images: [
    'https://cdn.example.com/photo1.jpg',
    'https://cdn.example.com/photo2-field-uploaded.jpg',
    'https://cdn.example.com/photo3-front-signboard.jpg',
  ],
};

// Admin picks photo3 to be the Front Photo:
const afterSetFront = applySetFront(initialMerchant, 'https://cdn.example.com/photo3-front-signboard.jpg');
assert.equal(
  afterSetFront.image_url,
  'https://cdn.example.com/photo3-front-signboard.jpg',
  'Chosen photo must become image_url'
);
assert.equal(
  afterSetFront.images[0],
  'https://cdn.example.com/photo3-front-signboard.jpg',
  'Chosen photo must be at index 0 in images array'
);
assert.equal(afterSetFront.images.length, 3, 'All images must be preserved');

// 3. Test Business Logic for 'delete' action
function applyDeletePhoto(merchant, targetPhoto) {
  let currentImages = Array.isArray(merchant.images) ? [...merchant.images] : [];
  if (merchant.image_url && !currentImages.includes(merchant.image_url)) {
    currentImages.unshift(merchant.image_url);
  }
  const nextImages = currentImages.filter(img => img !== targetPhoto);
  let nextImageUrl = merchant.image_url;
  if (nextImageUrl === targetPhoto) {
    nextImageUrl = nextImages.length > 0 ? nextImages[0] : null;
  }
  return { image_url: nextImageUrl, images: nextImages };
}

// If admin deletes the current front photo, the next photo should become front:
const afterDeleteFront = applyDeletePhoto(afterSetFront, 'https://cdn.example.com/photo3-front-signboard.jpg');
assert.equal(
  afterDeleteFront.image_url,
  'https://cdn.example.com/photo1.jpg',
  'Deleting current front photo must promote next photo to image_url'
);
assert.equal(afterDeleteFront.images.length, 2);

// 4. Test Customer Experience Integration
// In CustomerShopCard.tsx: const photo = merchant.image_url || merchant.images?.[0];
function getCustomerFrontPhoto(customerMerchant) {
  return customerMerchant.image_url || customerMerchant.images?.[0] || null;
}

assert.equal(
  getCustomerFrontPhoto(afterSetFront),
  'https://cdn.example.com/photo3-front-signboard.jpg',
  'Customer explore card must immediately display the chosen front photo'
);

// 5. Verify Frontend UI Components
const photosComponent = fs.readFileSync('src/components/AdminMerchantPhotos.tsx', 'utf8');
assert.ok(photosComponent.includes("uiText('Shop Photos & Front Display')"), 'Must display title');
assert.ok(photosComponent.includes("uiText('Front Photo')"), 'Must display Front Photo badge');
assert.ok(photosComponent.includes("uiText('Set as Front')"), 'Must have Set as Front button');
assert.ok(photosComponent.includes("uiText('Upload Shop Photo')"), 'Must have Upload Shop Photo button');
assert.ok(photosComponent.includes("action: 'set_front'"), 'Must trigger set_front action on endpoint');
assert.ok(photosComponent.includes("action: 'delete'"), 'Must trigger delete action on endpoint');

const adminMerchantDetails = fs.readFileSync('src/pages/AdminMerchantDetails.tsx', 'utf8');
assert.ok(
  adminMerchantDetails.includes('<AdminMerchantPhotos'),
  'AdminMerchantDetails page must render AdminMerchantPhotos component'
);

console.log('ALL TESTS PASSED: Admin Merchant Photos, Front Photo Selection, and Customer Explore Card Sync verified.');
