const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { deleteFileFromCloudStorage, isCloudStorageUrl } = require('./cloud-storage.cjs');

const BANNERS_FILE = path.join(__dirname, 'ad-banners.json');
const CONFIG_BUCKET = 'app-config';
const CONFIG_FILE = 'ad-banners.json';

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const nlat1 = Number(lat1), nlon1 = Number(lon1), nlat2 = Number(lat2), nlon2 = Number(lon2);
  if (!Number.isFinite(nlat1) || !Number.isFinite(nlon1) || !Number.isFinite(nlat2) || !Number.isFinite(nlon2)) return Infinity;
  const rad = Math.PI / 180;
  const a = Math.sin((nlat2 - nlat1) * rad / 2) ** 2 + Math.cos(nlat1 * rad) * Math.cos(nlat2 * rad) * Math.sin((nlon2 - nlon1) * rad / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function getBannerImageExtension(mimetype) {
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/webp') return 'webp';
  return 'jpg';
}

function loadLocalBanners() {
  try {
    if (fs.existsSync(BANNERS_FILE)) {
      const content = fs.readFileSync(BANNERS_FILE, 'utf8');
      const parsed = JSON.parse(content || '[]');
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[ad-banners] Error reading local banners file:', err.message);
  }
  return [];
}

function saveLocalBanners(banners) {
  try {
    fs.writeFileSync(BANNERS_FILE, JSON.stringify(banners, null, 2), 'utf8');
  } catch (err) {
    console.warn('[ad-banners] Error saving local banners file:', err.message);
  }
}

async function syncToSupabase(supabase, banners) {
  if (!supabase) return;
  try {
    const payload = Buffer.from(JSON.stringify(banners, null, 2));
    await supabase.storage.from(CONFIG_BUCKET).upload(CONFIG_FILE, payload, {
      upsert: true,
      contentType: 'application/json',
    });
  } catch (err) {
    console.warn('[ad-banners] Storage sync skipped:', err.message);
  }
}

async function loadBannersFromStorage(supabase) {
  if (supabase) {
    try {
      const { data, error } = await supabase.storage.from(CONFIG_BUCKET).download(CONFIG_FILE);
      if (data && !error) {
        const text = await data.text();
        const parsed = JSON.parse(text || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          saveLocalBanners(parsed);
          return parsed;
        }
      }
    } catch (_) {}
  }
  return loadLocalBanners();
}

async function resolveBannerImageUrl(banner, supabase, bucket, signedUrlHelper) {
  const imgPath = banner.imagePath || banner.imageUrl;
  if (!imgPath) return '';

  if (imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('data:')) {
    return imgPath;
  }
  if (typeof signedUrlHelper === 'function') {
    try {
      const signed = await signedUrlHelper(imgPath);
      if (signed) return signed;
    } catch (_) {}
  }
  if (supabase && bucket) {
    try {
      const publicUrl = supabase.storage.from(bucket).getPublicUrl(imgPath)?.data?.publicUrl;
      if (publicUrl) return publicUrl;
    } catch (_) {}
  }
  return banner.imageUrl || '';
}

function registerAdBanners(app, { auth, adminRole, customerAuth, supabase, upload, bucket, signedUrlHelper, setOfferBannerPathHelper, uploadImageHelper }) {
  // Public / Customer endpoint: GET /api/customer/banners
  const customerHandler = async (req, res) => {
    try {
      const allBanners = await loadBannersFromStorage(supabase);
      const activeBanners = allBanners.filter(b => b.active);

      const latitude = req.query.latitude == null ? NaN : Number(req.query.latitude);
      const longitude = req.query.longitude == null ? NaN : Number(req.query.longitude);
      const nearby = Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;

      const resolved = await Promise.all(activeBanners.map(async b => {
        const imgUrl = await resolveBannerImageUrl(b, supabase, bucket, signedUrlHelper);
        const offerImgUrl = b.offerImagePath ? await resolveBannerImageUrl({ imagePath: b.offerImagePath, imageUrl: b.offerImageUrl }, supabase, bucket, signedUrlHelper) : imgUrl;
        const dist = nearby ? calculateDistance(latitude, longitude, b.latitude, b.longitude) : Infinity;

        return {
          id: b.id,
          offerId: b.offerId || b.linkValue,
          merchantId: b.merchantId,
          merchantName: b.merchantName,
          merchantPhone: b.merchantPhone,
          merchantAddress: b.merchantAddress,
          title: b.title,
          subtitle: b.subtitle || '',
          placement: 'top',
          linkType: 'offer',
          linkValue: b.linkValue || b.offerId || '',
          active: b.active,
          displayOrder: Number(b.displayOrder || 0),
          imageUrl: imgUrl || offerImgUrl,
          bannerImageUrl: imgUrl,
          offerImageUrl: offerImgUrl,
          imagePath: b.imagePath,
          distance: dist,
          createdAt: b.createdAt,
        };
      }));

      if (nearby) {
        resolved.sort((a, b) => a.distance - b.distance);
      } else {
        resolved.sort((a, b) => (a.displayOrder - b.displayOrder) || (new Date(b.createdAt) - new Date(a.createdAt)));
      }

      res.json({ banners: resolved });
    } catch (err) {
      console.error('[ad-banners] Error getting customer banners:', err);
      res.status(500).json({ error: 'Failed to load banners' });
    }
  };

  app.get('/api/customer/banners', customerHandler);

  // Admin endpoint: GET /api/admin/banners
  app.get('/api/admin/banners', auth, adminRole, async (_req, res) => {
    try {
      const banners = await loadBannersFromStorage(supabase);
      const resolved = await Promise.all(banners.map(async b => {
        const imgUrl = await resolveBannerImageUrl(b, supabase, bucket, signedUrlHelper);
        const offerImgUrl = b.offerImagePath ? await resolveBannerImageUrl({ imagePath: b.offerImagePath, imageUrl: b.offerImageUrl }, supabase, bucket, signedUrlHelper) : (b.offerImageUrl || imgUrl);
        return {
          id: b.id,
          offerId: b.offerId || b.linkValue || '',
          merchantId: b.merchantId || '',
          merchantName: b.merchantName || '',
          merchantPhone: b.merchantPhone || '',
          merchantAddress: b.merchantAddress || '',
          title: b.title,
          subtitle: b.subtitle || '',
          category: b.category || '',
          expiresAt: b.expiresAt || '',
          placement: 'top',
          linkType: 'offer',
          linkValue: b.linkValue || b.offerId || '',
          active: Boolean(b.active),
          displayOrder: Number(b.displayOrder || 0),
          imageUrl: imgUrl || offerImgUrl,
          bannerImageUrl: imgUrl,
          offerImageUrl: offerImgUrl,
          imagePath: b.imagePath,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        };
      }));

      resolved.sort((a, b) => (a.displayOrder - b.displayOrder) || (new Date(b.createdAt) - new Date(a.createdAt)));
      res.json({ banners: resolved });
    } catch (err) {
      console.error('[ad-banners] Error listing admin banners:', err);
      res.status(500).json({ error: 'Failed to retrieve ad banners' });
    }
  });

  // Admin upload middleware supporting any image field name
  const uploadMiddleware = (req, res, next) => {
    if (!upload) return next();
    if (typeof upload.any === 'function') {
      return upload.any()(req, res, (err) => {
        if (err) {
          console.warn('[ad-banners] Upload warning/error:', err.message);
          return res.status(400).json({ error: err.message || 'Image upload failed' });
        }
        if (req.files && req.files.length) {
          req.file = req.files.find(f => f.fieldname === 'image' || f.fieldname === 'photo' || f.fieldname === 'bannerImage') || req.files[0];
        }
        next();
      });
    }
    if (typeof upload.single === 'function') {
      return upload.single('image')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message || 'Image upload failed' });
        next();
      });
    }
    next();
  };

  app.post('/api/admin/banners', auth, adminRole, uploadMiddleware, async (req, res) => {
    try {
      const offerId = (req.body.offerId || req.body.linkValue || '').trim();
      let title = (req.body.title || '').trim();
      let subtitle = (req.body.subtitle || '').trim();
      let merchantId = (req.body.merchantId || '').trim();
      let merchantName = (req.body.merchantName || '').trim();
      let merchantPhone = (req.body.merchantPhone || '').trim();
      let merchantAddress = (req.body.merchantAddress || '').trim();
      let category = (req.body.category || '').trim();
      let expiresAt = (req.body.expiresAt || '').trim();
      let offerImagePath = (req.body.offerImagePath || '').trim();
      let offerImageUrl = (req.body.offerImageUrl || '').trim();
      let latitude = null;
      let longitude = null;

      // If offerId provided, load offer details from database
      if (offerId && supabase) {
        try {
          const { data: offer } = await supabase
            .from('offers')
            .select('id, title, description, category, image_path, expires_at, merchant_id, merchants(id, name, phone, address, latitude, longitude)')
            .eq('id', offerId)
            .maybeSingle();

          if (offer) {
            title = title || offer.title;
            subtitle = subtitle || offer.description;
            merchantId = merchantId || offer.merchant_id || offer.merchants?.id;
            merchantName = merchantName || offer.merchants?.name || '';
            merchantPhone = merchantPhone || offer.merchants?.phone || '';
            merchantAddress = merchantAddress || offer.merchants?.address || '';
            category = category || offer.category || '';
            expiresAt = expiresAt || offer.expires_at || '';
            offerImagePath = offerImagePath || offer.image_path || '';
            latitude = offer.merchants?.latitude || null;
            longitude = offer.merchants?.longitude || null;
          }
        } catch (_) {}
      }

      // If merchantId provided without coordinates, check merchant table
      if (merchantId && !latitude && supabase) {
        try {
          const { data: m } = await supabase.from('merchants').select('name, phone, address, latitude, longitude').eq('id', merchantId).maybeSingle();
          if (m) {
            merchantName = merchantName || m.name || '';
            merchantPhone = merchantPhone || m.phone || '';
            merchantAddress = merchantAddress || m.address || '';
            latitude = m.latitude || null;
            longitude = m.longitude || null;
          }
        } catch (_) {}
      }

      if (!title) {
        title = merchantName ? `Featured Offer from ${merchantName}` : 'Special Promotion';
      }

      let imagePath = '';
      let imageUrl = '';

      if (req.file) {
        const uploadFolder = merchantId && /^[0-9a-f-]{36}$/i.test(merchantId) ? merchantId : 'admin';
        
        // Use uploadImageHelper if available (delegates directly to uploadOfferImage in server.js)
        if (typeof uploadImageHelper === 'function') {
          try {
            imagePath = await uploadImageHelper(uploadFolder, req.file);
          } catch (uploadErr) {
            console.warn('[ad-banners] uploadImageHelper error, falling back:', uploadErr.message);
          }
        }

        if (!imagePath && supabase && bucket) {
          try {
            const ext = getBannerImageExtension(req.file.mimetype);
            const fileId = crypto.randomUUID();
            const storagePath = `${uploadFolder}/${fileId}.${ext}`;
            const { error: uploadErr } = await supabase.storage
              .from(bucket)
              .upload(storagePath, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false,
              });
            if (!uploadErr) imagePath = storagePath;
          } catch (err) {
            console.warn('[ad-banners] Supabase storage upload failed:', err.message);
          }
        }

        if (!imagePath) {
          // Local fallback
          const ext = getBannerImageExtension(req.file.mimetype);
          const fileId = crypto.randomUUID();
          const publicUploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'banners');
          try {
            if (!fs.existsSync(publicUploadsDir)) fs.mkdirSync(publicUploadsDir, { recursive: true });
            const localFilename = `${fileId}.${ext}`;
            fs.writeFileSync(path.join(publicUploadsDir, localFilename), req.file.buffer);
            imagePath = `/uploads/banners/${localFilename}`;
            imageUrl = imagePath;
          } catch (_) {
            imagePath = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            imageUrl = imagePath;
          }
        }
      } else if (req.body.imageUrl) {
        imagePath = req.body.imageUrl.trim();
        imageUrl = imagePath;
      } else if (offerImagePath) {
        imagePath = offerImagePath;
      }

      if (!imagePath && !offerImageUrl) {
        return res.status(400).json({ error: 'Please choose an offer with a photo or upload a banner image.' });
      }

      const active = req.body.active !== 'false' && req.body.active !== false;
      const displayOrder = Number(req.body.displayOrder || 0);

      const newBanner = {
        id: crypto.randomUUID(),
        offerId,
        merchantId,
        merchantName,
        merchantPhone,
        merchantAddress,
        latitude,
        longitude,
        title,
        subtitle,
        category,
        expiresAt,
        placement: 'top',
        linkType: 'offer',
        linkValue: offerId,
        active,
        displayOrder,
        imagePath: imagePath || offerImagePath,
        imageUrl: imageUrl || offerImageUrl,
        offerImagePath,
        offerImageUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const banners = await loadBannersFromStorage(supabase);
      banners.unshift(newBanner);
      saveLocalBanners(banners);
      await syncToSupabase(supabase, banners);

      if (offerId && req.file && typeof setOfferBannerPathHelper === 'function') {
        try { await setOfferBannerPathHelper(offerId, imagePath); } catch (_) {}
      }

      newBanner.imageUrl = await resolveBannerImageUrl(newBanner, supabase, bucket, signedUrlHelper);

      res.status(201).json({ success: true, banner: newBanner });
    } catch (err) {
      console.error('[ad-banners] Error creating banner:', err);
      res.status(500).json({ error: err.message || 'Failed to create banner' });
    }
  });

  // Admin endpoint: PUT /api/admin/banners/:id
  app.put('/api/admin/banners/:id', auth, adminRole, uploadMiddleware, async (req, res) => {
    try {
      const bannerId = req.params.id;
      const banners = await loadBannersFromStorage(supabase);
      const index = banners.findIndex(b => b.id === bannerId);

      if (index === -1) {
        return res.status(404).json({ error: 'Banner not found.' });
      }

      const existing = banners[index];
      const offerId = req.body.offerId !== undefined ? String(req.body.offerId).trim() : (existing.offerId || '');
      let title = req.body.title !== undefined ? String(req.body.title).trim() : existing.title;
      let subtitle = req.body.subtitle !== undefined ? String(req.body.subtitle).trim() : (existing.subtitle || '');
      let merchantId = req.body.merchantId !== undefined ? String(req.body.merchantId).trim() : (existing.merchantId || '');
      let merchantName = req.body.merchantName !== undefined ? String(req.body.merchantName).trim() : (existing.merchantName || '');
      let merchantPhone = req.body.merchantPhone !== undefined ? String(req.body.merchantPhone).trim() : (existing.merchantPhone || '');
      let merchantAddress = req.body.merchantAddress !== undefined ? String(req.body.merchantAddress).trim() : (existing.merchantAddress || '');
      let category = req.body.category !== undefined ? String(req.body.category).trim() : (existing.category || '');
      let expiresAt = req.body.expiresAt !== undefined ? String(req.body.expiresAt).trim() : (existing.expiresAt || '');
      let offerImagePath = req.body.offerImagePath !== undefined ? String(req.body.offerImagePath).trim() : (existing.offerImagePath || '');
      let offerImageUrl = req.body.offerImageUrl !== undefined ? String(req.body.offerImageUrl).trim() : (existing.offerImageUrl || '');
      let latitude = existing.latitude || null;
      let longitude = existing.longitude || null;

      if (offerId && offerId !== existing.offerId && supabase) {
        try {
          const { data: offer } = await supabase
            .from('offers')
            .select('id, title, description, category, image_path, expires_at, merchant_id, merchants(id, name, phone, address, latitude, longitude)')
            .eq('id', offerId)
            .maybeSingle();

          if (offer) {
            title = offer.title;
            subtitle = offer.description;
            merchantId = offer.merchant_id || offer.merchants?.id;
            merchantName = offer.merchants?.name || '';
            merchantPhone = offer.merchants?.phone || '';
            merchantAddress = offer.merchants?.address || '';
            category = offer.category || '';
            expiresAt = offer.expires_at || '';
            offerImagePath = offer.image_path || '';
            latitude = offer.merchants?.latitude || null;
            longitude = offer.merchants?.longitude || null;
          }
        } catch (_) {}
      }

      let imagePath = existing.imagePath;
      let imageUrl = existing.imageUrl;

      if (req.file) {
        const uploadFolder = merchantId && /^[0-9a-f-]{36}$/i.test(merchantId) ? merchantId : 'admin';
        if (typeof uploadImageHelper === 'function') {
          try {
            imagePath = await uploadImageHelper(uploadFolder, req.file);
          } catch (uploadErr) {
            console.warn('[ad-banners] uploadImageHelper update error:', uploadErr.message);
          }
        }

        if (imagePath === existing.imagePath && supabase && bucket) {
          try {
            const ext = getBannerImageExtension(req.file.mimetype);
            const fileId = crypto.randomUUID();
            const storagePath = `${uploadFolder}/${fileId}.${ext}`;
            const { error: uploadErr } = await supabase.storage
              .from(bucket)
              .upload(storagePath, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false,
              });
            if (!uploadErr) imagePath = storagePath;
          } catch (_) {}
        }
      } else if (req.body.imageUrl && req.body.imageUrl.trim() !== existing.imageUrl) {
        imagePath = req.body.imageUrl.trim();
        imageUrl = imagePath;
      }

      const active = req.body.active !== undefined
        ? (req.body.active !== 'false' && req.body.active !== false)
        : existing.active;

      const updated = {
        ...existing,
        offerId,
        merchantId,
        merchantName,
        merchantPhone,
        merchantAddress,
        latitude,
        longitude,
        title,
        subtitle,
        category,
        expiresAt,
        placement: 'top',
        linkType: 'offer',
        linkValue: offerId,
        active,
        imagePath: imagePath || offerImagePath,
        imageUrl: imageUrl || offerImageUrl,
        offerImagePath,
        offerImageUrl,
        updatedAt: new Date().toISOString(),
      };

      banners[index] = updated;
      saveLocalBanners(banners);
      await syncToSupabase(supabase, banners);

      if (offerId && req.file && typeof setOfferBannerPathHelper === 'function') {
        try { await setOfferBannerPathHelper(offerId, imagePath); } catch (_) {}
      }

      updated.imageUrl = await resolveBannerImageUrl(updated, supabase, bucket, signedUrlHelper);

      res.json({ success: true, banner: updated });
    } catch (err) {
      console.error('[ad-banners] Error updating banner:', err);
      res.status(500).json({ error: err.message || 'Failed to update banner' });
    }
  });

  // Admin endpoint: PATCH /api/admin/banners/:id/toggle-active
  app.patch('/api/admin/banners/:id/toggle-active', auth, adminRole, async (req, res) => {
    try {
      const bannerId = req.params.id;
      const banners = await loadBannersFromStorage(supabase);
      const banner = banners.find(b => b.id === bannerId);

      if (!banner) {
        return res.status(404).json({ error: 'Banner not found.' });
      }

      banner.active = !banner.active;
      banner.updatedAt = new Date().toISOString();

      saveLocalBanners(banners);
      await syncToSupabase(supabase, banners);

      banner.imageUrl = await resolveBannerImageUrl(banner, supabase, bucket, signedUrlHelper);
      res.json({ success: true, banner });
    } catch (err) {
      console.error('[ad-banners] Error toggling banner active:', err);
      res.status(500).json({ error: 'Failed to toggle banner status' });
    }
  });

  // Admin endpoint: DELETE /api/admin/banners/:id
  app.delete('/api/admin/banners/:id', auth, adminRole, async (req, res) => {
    try {
      const bannerId = req.params.id;
      const banners = await loadBannersFromStorage(supabase);
      const index = banners.findIndex(b => b.id === bannerId);

      if (index === -1) {
        return res.status(404).json({ error: 'Banner not found.' });
      }

      const removed = banners[index];
      banners.splice(index, 1);
      saveLocalBanners(banners);
      await syncToSupabase(supabase, banners);

      if (removed.imagePath) {
        if (isCloudStorageUrl(removed.imagePath)) {
          await deleteFileFromCloudStorage(removed.imagePath);
        } else if (removed.imagePath.includes('/') && supabase && bucket) {
          await supabase.storage.from(bucket).remove([removed.imagePath]).catch(() => {});
        }
      }

      res.json({ success: true, message: 'Banner deleted successfully.' });
    } catch (err) {
      console.error('[ad-banners] Error deleting banner:', err);
      res.status(500).json({ error: 'Failed to delete banner' });
    }
  });
}

// Helper for server.js to get active banners for /api/customer/ads
async function getActiveBannersForAds(supabase, bucket, signedUrlHelper, userCoords) {
  try {
    const all = await loadBannersFromStorage(supabase);
    const topActive = all.filter(b => b.active);
    const nearby = userCoords && Number.isFinite(userCoords.latitude) && Number.isFinite(userCoords.longitude);

    return await Promise.all(topActive.map(async b => {
      const resolvedUrl = await resolveBannerImageUrl(b, supabase, bucket, signedUrlHelper);
      const offerImgUrl = b.offerImagePath
        ? await resolveBannerImageUrl({ imagePath: b.offerImagePath, imageUrl: b.offerImageUrl }, supabase, bucket, signedUrlHelper)
        : (b.offerImageUrl || resolvedUrl);

      const dist = nearby ? calculateDistance(userCoords.latitude, userCoords.longitude, b.latitude, b.longitude) : Infinity;

      return {
        id: `banner-${b.id}`,
        bannerId: b.id,
        offerId: b.offerId || b.linkValue,
        title: b.title,
        description: b.subtitle || '',
        rawDescription: b.subtitle || '',
        theme: 'blue',
        icon: 'gift',
        action: b.merchantName ? `View at ${b.merchantName}` : 'View offer',
        url: '/customer/offers',
        test: false,
        imageUrl: resolvedUrl || offerImgUrl,
        bannerImageUrl: resolvedUrl,
        offerImageUrl: offerImgUrl || resolvedUrl,
        merchantId: b.merchantId || '',
        merchantName: b.merchantName || '',
        merchantPhone: b.merchantPhone || '',
        merchantAddress: b.merchantAddress || '',
        category: b.category || '',
        expiresAt: b.expiresAt || '',
        isAdBanner: true,
        linkType: 'offer',
        linkValue: b.offerId || b.linkValue,
        distance: dist,
        latitude: b.latitude,
        longitude: b.longitude,
      };
    }));
  } catch (err) {
    console.warn('[ad-banners] Error getting active banners for ads:', err.message);
    return [];
  }
}

module.exports = {
  registerAdBanners,
  getActiveBannersForAds,
  loadBannersFromStorage,
  saveLocalBanners,
  calculateDistance,
};
