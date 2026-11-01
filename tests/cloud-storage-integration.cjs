const assert = require('node:assert/strict');
const cs = require('../backend/cloud-storage.cjs');

async function main() {
  console.log('Testing Cloud Storage upload and CDN resolution...');
  
  // 1. Upload a dummy image buffer
  const samplePngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const uploadPath = `tests/probe-${Date.now()}.png`;
  
  const publicUrl = await cs.uploadFileToCloudStorage(uploadPath, samplePngBuffer, 'image/png');
  console.log('Uploaded to GCS:', publicUrl);
  
  assert.ok(publicUrl.startsWith(`https://storage.googleapis.com/${cs.BUCKET_NAME}/`));
  assert.ok(cs.isCloudStorageUrl(publicUrl));

  // 2. Resolve image URL
  const resolved = await cs.resolveImageUrl(publicUrl, null);
  assert.equal(resolved, publicUrl);
  console.log('URL resolution verified.');

  // 3. Test HTTP fetch from Google CDN
  const response = await fetch(publicUrl);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  console.log('CDN delivery verified (HTTP 200).');

  // 4. Cleanup
  const deleted = await cs.deleteFileFromCloudStorage(publicUrl);
  assert.equal(deleted, true);
  console.log('Cleanup verified.');

  console.log('ALL CLOUD STORAGE INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

