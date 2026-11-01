require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const cs = require('../backend/cloud-storage.cjs');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`Starting Supabase -> Google Cloud Storage Migration (Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE APPLY'})...`);
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env');
    process.exit(1);
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const OFFER_BUCKET = process.env.OFFER_IMAGE_BUCKET || 'offers';

  // 1. Check existing buckets on Supabase to find exact offer bucket name
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketNames = (buckets || []).map(b => b.name);
  console.log('Available Supabase storage buckets:', bucketNames);
  
  const targetOfferBucket = bucketNames.includes(OFFER_BUCKET)
    ? OFFER_BUCKET
    : (bucketNames.includes('offer-images') ? 'offer-images' : OFFER_BUCKET);
  console.log(`Using Supabase source bucket: "${targetOfferBucket}"`);

  let totalMigrated = 0;
  let totalErrors = 0;

  // -------------------------------------------------------------
  // Step A: Migrate Offers
  // -------------------------------------------------------------
  console.log('\n--- Checking Offers ---');
  const { data: offers, error: offersErr } = await supabase
    .from('offers')
    .select('id, title, image_path');

  if (offersErr) {
    console.warn('Could not load offers:', offersErr.message);
  } else {
    console.log(`Found ${offers.length} total offers in database.`);
    for (const offer of offers) {
      if (!offer.image_path) continue;
      if (cs.isCloudStorageUrl(offer.image_path)) {
        // Already on Google Cloud Storage
        continue;
      }

      console.log(`Migrating Offer [${offer.id}] "${offer.title}": ${offer.image_path}...`);
      if (DRY_RUN) {
        totalMigrated++;
        continue;
      }

      try {
        // Download from Supabase
        const { data: fileData, error: dlErr } = await supabase.storage
          .from(targetOfferBucket)
          .download(offer.image_path);

        if (dlErr || !fileData) {
          // Try 'offers' bucket if targetOfferBucket was 'offer-images' or vice versa
          const altBucket = targetOfferBucket === 'offers' ? 'offer-images' : 'offers';
          const { data: altData, error: altErr } = await supabase.storage.from(altBucket).download(offer.image_path);
          if (altErr || !altData) {
            console.warn(`  [SKIP] Could not download from Supabase: ${dlErr?.message || altErr?.message}`);
            totalErrors++;
            continue;
          }
          const buffer = Buffer.from(await altData.arrayBuffer());
          const destPath = `offers/${offer.image_path.replace(/^\/+/, '')}`;
          const gcsUrl = await cs.uploadFileToCloudStorage(destPath, buffer, 'image/jpeg');
          await supabase.from('offers').update({ image_path: gcsUrl }).eq('id', offer.id);
          console.log(`  -> Migrated to: ${gcsUrl}`);
          totalMigrated++;
          continue;
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());
        const destPath = `offers/${offer.image_path.replace(/^\/+/, '')}`;
        const gcsUrl = await cs.uploadFileToCloudStorage(destPath, buffer, 'image/jpeg');

        // Update database row to the new Google Cloud CDN URL
        await supabase.from('offers').update({ image_path: gcsUrl }).eq('id', offer.id);
        console.log(`  -> Migrated to: ${gcsUrl}`);
        totalMigrated++;
      } catch (err) {
        console.error(`  [ERROR] Failed to migrate offer ${offer.id}:`, err.message);
        totalErrors++;
      }
    }
  }

  // -------------------------------------------------------------
  // Step B: Migrate Merchant Shop Photos
  // -------------------------------------------------------------
  console.log('\n--- Checking Merchant Photos ---');
  const { data: merchants, error: merchErr } = await supabase
    .from('active_merchants')
    .select('id, name, image_url, images');

  if (merchErr) {
    console.warn('Could not load active_merchants:', merchErr.message);
  } else {
    console.log(`Found ${merchants.length} total active merchants.`);
    for (const m of merchants) {
      let updatedImageUrl = m.image_url;
      let updatedImages = Array.isArray(m.images) ? [...m.images] : [];
      let modified = false;

      // Check single image_url
      if (m.image_url && !cs.isCloudStorageUrl(m.image_url) && !m.image_url.startsWith('data:')) {
        console.log(`Migrating Merchant [${m.id}] front photo: ${m.image_url}...`);
        if (!DRY_RUN) {
          try {
            const { data: fData, error: fErr } = await supabase.storage.from(targetOfferBucket).download(m.image_url);
            if (!fErr && fData) {
              const buffer = Buffer.from(await fData.arrayBuffer());
              const destPath = `shops/${m.id}/${m.image_url.replace(/^\/+/, '')}`;
              const gcsUrl = await cs.uploadFileToCloudStorage(destPath, buffer, 'image/jpeg');
              updatedImageUrl = gcsUrl;
              modified = true;
              totalMigrated++;
            }
          } catch (err) {
            console.warn(`  [SKIP] Merchant front photo error:`, err.message);
          }
        } else {
          totalMigrated++;
        }
      }

      if (modified && !DRY_RUN) {
        await supabase.from('active_merchants').update({
          image_url: updatedImageUrl,
          images: updatedImages,
        }).eq('id', m.id);
        console.log(`  -> Updated merchant ${m.name}`);
      }
    }
  }

  // -------------------------------------------------------------
  // Step C: Migrate Dedicated Ad Banners
  // -------------------------------------------------------------
  console.log('\n--- Checking Ad Banners ---');
  try {
    const { data: bData, error: bErr } = await supabase.storage.from('app-config').download('ad-banners.json');
    if (!bErr && bData) {
      const banners = JSON.parse(await bData.text());
      let bannersModified = false;
      for (const banner of banners) {
        if (banner.imagePath && !cs.isCloudStorageUrl(banner.imagePath)) {
          console.log(`Migrating Banner [${banner.id}] imagePath: ${banner.imagePath}...`);
          if (!DRY_RUN) {
            try {
              const { data: imgData, error: imgErr } = await supabase.storage.from(targetOfferBucket).download(banner.imagePath);
              if (!imgErr && imgData) {
                const buffer = Buffer.from(await imgData.arrayBuffer());
                const destPath = `banners/${banner.imagePath.replace(/^\/+/, '')}`;
                const gcsUrl = await cs.uploadFileToCloudStorage(destPath, buffer, 'image/jpeg');
                banner.imagePath = gcsUrl;
                banner.imageUrl = gcsUrl;
                bannersModified = true;
                totalMigrated++;
                console.log(`  -> Migrated banner image to: ${gcsUrl}`);
              }
            } catch (bErr) {
              console.warn('  [SKIP] Banner image download error:', bErr.message);
            }
          } else {
            totalMigrated++;
          }
        }
      }
      if (bannersModified && !DRY_RUN) {
        const payload = Buffer.from(JSON.stringify(banners, null, 2), 'utf8');
        await supabase.storage.from('app-config').upload('ad-banners.json', payload, {
          contentType: 'application/json',
          upsert: true,
        });
        console.log('  -> Updated remote ad-banners.json with Cloud Storage URLs');
      }
    }
  } catch (err) {
    console.warn('Could not process ad banners:', err.message);
  }

  console.log('\n=============================================');
  console.log(`Migration Complete!`);
  console.log(`Migrated: ${totalMigrated}`);
  console.log(`Errors / Unreachable: ${totalErrors}`);
  console.log('=============================================\n');
}

main().catch(err => {
  console.error('Migration script failed:', err);
  process.exit(1);
});
