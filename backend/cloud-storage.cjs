const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const path = require('path');
const fs = require('fs');

const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET || process.env.GCS_BUCKET_NAME || 'ae-app-media-storage-2026';

let cloudBucket = null;

function getCloudBucket() {
  if (cloudBucket) return cloudBucket;

  try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
    let serviceAccount = null;
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = require(serviceAccountPath);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    }

    if (!serviceAccount) {
      console.warn('[cloud-storage] No Firebase service account found, cloud storage unavailable.');
      return null;
    }

    let app = getApps().length > 0 ? getApps()[0] : null;
    if (!app) {
      app = initializeApp({
        credential: cert(serviceAccount),
        storageBucket: BUCKET_NAME,
      });
    }

    cloudBucket = getStorage(app).bucket(BUCKET_NAME);
    return cloudBucket;
  } catch (err) {
    console.warn('[cloud-storage] Initialization error:', err.message);
    return null;
  }
}

/**
 * Check if a path or URL is already a public Cloud Storage URL or web URL
 */
function isCloudStorageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:');
}

/**
 * Uploads a file buffer to Google Cloud / Firebase Storage (Mumbai ASIA-SOUTH1)
 * Sets public read permission and cache headers.
 * Returns the permanent public CDN URL.
 */
async function uploadFileToCloudStorage(destinationPath, fileBuffer, mimeType) {
  const bucket = getCloudBucket();
  if (!bucket) {
    throw new Error('Cloud Storage bucket is not available');
  }

  // Ensure clean destination path without leading slash
  const cleanPath = destinationPath.replace(/^\/+/, '');
  const file = bucket.file(cleanPath);

  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType || 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    resumable: false,
  });

  // Make public so customers can fetch via Google's edge CDN without signing tokens
  await file.makePublic().catch((err) => {
    console.warn('[cloud-storage] makePublic warning (bucket policy may already allow public read):', err.message);
  });

  return `https://storage.googleapis.com/${BUCKET_NAME}/${cleanPath}`;
}

/**
 * Deletes a file from Cloud Storage if it exists.
 */
async function deleteFileFromCloudStorage(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return false;
  const bucket = getCloudBucket();
  if (!bucket) return false;

  try {
    let cleanPath = urlOrPath;
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      // Extract file path from URL: e.g. https://storage.googleapis.com/ae-app-media-storage-2026/offers/abc.jpg
      const urlObj = new URL(urlOrPath);
      const prefix = `/${BUCKET_NAME}/`;
      if (urlObj.pathname.startsWith(prefix)) {
        cleanPath = decodeURIComponent(urlObj.pathname.slice(prefix.length));
      } else {
        cleanPath = decodeURIComponent(urlObj.pathname.replace(/^\/+/, ''));
      }
    }

    const file = bucket.file(cleanPath);
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      return true;
    }
  } catch (err) {
    console.warn('[cloud-storage] deleteFile error:', err.message);
  }
  return false;
}

/**
 * Resolves an image URL:
 * - If already a Cloud Storage / web URL, returns directly
 * - If legacy relative Supabase path, creates signed URL from Supabase
 */
async function resolveImageUrl(pathOrUrl, supabaseAdmin, defaultBucket = 'offer-images') {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  if (isCloudStorageUrl(pathOrUrl)) {
    return pathOrUrl;
  }
  if (!supabaseAdmin) return pathOrUrl;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(defaultBucket)
      .createSignedUrl(pathOrUrl, 60 * 60);
    return error ? '' : data?.signedUrl || '';
  } catch {
    return '';
  }
}

module.exports = {
  BUCKET_NAME,
  getCloudBucket,
  isCloudStorageUrl,
  uploadFileToCloudStorage,
  deleteFileFromCloudStorage,
  resolveImageUrl,
};
