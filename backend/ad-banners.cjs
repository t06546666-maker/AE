const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BANNERS_FILE = path.join(__dirname, 'ad-banners.json');
const APP_SETTINGS_KEY = 'app_ad_banners';

function getBannerImageExtension(mimetype) {
  if (mimetype === 'image/jpeg') return 'jpg';
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/webp') return 'webp';
  return 'bin';
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
    await supabase.from('app_settings').upsert({
      key: APP_SETTINGS_KEY,
      value: JSON.stringify(banners),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
  } catch (err) {
    console.warn('[ad-banners] Supabase app_settings sync skipped:', err.message);
  }
}

async function loadBannersFromStorage(supabase) {
  const local = loadLocalBanners();
  if (local && local.length > 0) return local;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', APP_SETTINGS_KEY)
        .maybeSingle();

      if (data?.value) {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (Array.isArray(parsed)) {
          saveLocalBanners(parsed);
          return parsed;
        }
      }
    } catch (_) {}
  }
  return local;
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

function registerAdBanners(app, { auth, adminRole, customerAuth, supabase, upload, bucket, signedUrlHelper, setOfferBannerPathHelper }) {
  // Public / Customer endpoint: GET /api/customer/banners
  const customerHandler = async (req, res) => {
    try {
      const placement = req.query.placement || 'top';
      const allBanners = await loadBannersFromStorage(supabase);
      const activeBanners = allBanners.filter(b => b.active);
      const filtered = placement === 'all'
        ? activeBanners
        : activeBanners.filter(b => (b.placement || 'top') === placement);

      const resolved = await Promise.all(filtered.map(async b => {
        const imgUrl = await resolveBannerImageUrl(b, supabase, bucket, signedUrlHelper);
        const offerImgUrl = b.offerImagePath ? await resolveBannerImageUrl({ imagePath: b.offerImagePath, imageUrl: b.offerImageUrl }, supabase, bucket, signedUrlHelper) : imgUrl;
        return {
          id: b.id,
          offerId: b.offerId || b.linkValue,
          merchantId: b.merchantId,
          merchantName: b.merchantName,
          merchantPhone: b.merchantPhone,
          merchantAddress: b.merchantAddress,
          title: b.title,
          subtitle: b.subtitle || '',
          placement: b.placement || 'top',
          linkType: b.linkType || 'offer',
          linkValue: b.linkValue || b.offerId || '',
          active: b.active,
          displayOrder: Number(b.displayOrder || 0),
          imageUrl: imgUrl || offerImgUrl,
          bannerImageUrl: imgUrl,
          offerImageUrl: offerImgUrl,
          imagePath: b.imagePath,
          createdAt: b.createdAt,
        };
      }));

      resolved.sort((a, b) => (a.displayOrder - b.displayOrder) || (new Date(b.createdAt) - new Date(a.createdAt)));
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
          placement: b.placement || 'top',
          linkType: b.linkType || 'offer',
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

  // Admin endpoint: POST /api/admin/banners
  const uploadMiddleware = upload && typeof upload.single === 'function'
    ? upload.single('image')
    : (_req, _res, next) => next();

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

      // If offerId provided and Supabase available, fetch offer details to auto-fill
      if (offerId && supabase) {
        try {
          const { data: offer } = await supabase
            .from('offers')
            .select('id, title, description, category, image_path, expires_at, merchant_id, merchants(id, name, phone, address)')
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
          }
        } catch (_) {}
      }

      if (!title) {
        title = 'Special Offer';
      }

      let imagePath = '';
      let imageUrl = '';

      if (req.file) {
        const ext = getBannerImageExtension(req.file.mimetype);
        const fileId = crypto.randomUUID();
        const storagePath = `banners/${fileId}.${ext}`;

        if (supabase && bucket) {
          try {
            const { error: uploadErr } = await supabase.storage
              .from(bucket)
              .upload(storagePath, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false,
              });
            if (uploadErr) throw uploadErr;
            imagePath = storagePath;
          } catch (uploadErr) {
            console.warn('[ad-banners] Storage upload fallback:', uploadErr.message);
          }
        }

        if (!imagePath) {
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
        // Optional banner image: falls back to offer image poster
        imagePath = offerImagePath;
      }

      if (!imagePath && !offerImageUrl) {
        return res.status(400).json({ error: 'Please choose an offer with an image or upload a banner image.' });
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

      if (offerId && offerId !== existing.offerId && supabase) {
        try {
          const { data: offer } = await supabase
            .from('offers')
            .select('id, title, description, category, image_path, expires_at, merchant_id, merchants(id, name, phone, address)')
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
          }
        } catch (_) {}
      }

      let imagePath = existing.imagePath;
      let imageUrl = existing.imageUrl;

      if (req.file) {
        const ext = getBannerImageExtension(req.file.mimetype);
        const fileId = crypto.randomUUID();
        const storagePath = `banners/${fileId}.${ext}`;

        if (supabase && bucket) {
          try {
            const { error: uploadErr } = await supabase.storage
              .from(bucket)
              .upload(storagePath, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false,
              });
            if (!uploadErr) {
              if (existing.imagePath && existing.imagePath.startsWith('banners/')) {
                await supabase.storage.from(bucket).remove([existing.imagePath]).catch(() => {});
              }
              imagePath = storagePath;
              imageUrl = '';
            }
          } catch (_) {}
        }

        if (imagePath === existing.imagePath && req.file) {
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

      if (removed.imagePath && removed.imagePath.startsWith('banners/') && supabase && bucket) {
        await supabase.storage.from(bucket).remove([removed.imagePath]).catch(() => {});
      } else if (removed.imagePath && removed.imagePath.startsWith('/uploads/banners/')) {
        const localFile = path.join(__dirname, '..', 'public', removed.imagePath.replace(/^\//, ''));
        if (fs.existsSync(localFile)) {
          fs.unlinkSync(localFile);
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
async function getActiveBannersForAds(supabase, bucket, signedUrlHelper) {
  try {
    const all = await loadBannersFromStorage(supabase);
    const topActive = all.filter(b => b.active && (b.placement === 'top' || !b.placement));
    return await Promise.all(topActive.map(async b => {
      const resolvedUrl = await resolveBannerImageUrl(b, supabase, bucket, signedUrlHelper);
      const offerImgUrl = b.offerImagePath
        ? await resolveBannerImageUrl({ imagePath: b.offerImagePath, imageUrl: b.offerImageUrl }, supabase, bucket, signedUrlHelper)
        : (b.offerImageUrl || resolvedUrl);

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
        merchantName: b.merchantName || '',
        merchantPhone: b.merchantPhone || '',
        merchantAddress: b.merchantAddress || '',
        category: b.category || '',
        expiresAt: b.expiresAt || '',
        isAdBanner: true,
        linkType: 'offer',
        linkValue: b.offerId || b.linkValue,
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
};
