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
    // Non-blocking sync warning
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
  if (!banner.imagePath) {
    return banner.imageUrl || '';
  }
  // If it's already a full http(s) URL or base64 data URI, return it
  if (banner.imagePath.startsWith('http://') || banner.imagePath.startsWith('https://') || banner.imagePath.startsWith('data:')) {
    return banner.imagePath;
  }
  // Try signed URL from helper
  if (typeof signedUrlHelper === 'function') {
    try {
      const signed = await signedUrlHelper(banner.imagePath);
      if (signed) return signed;
    } catch (_) {}
  }
  // Try Supabase storage getPublicUrl
  if (supabase && bucket) {
    try {
      const publicUrl = supabase.storage.from(bucket).getPublicUrl(banner.imagePath)?.data?.publicUrl;
      if (publicUrl) return publicUrl;
    } catch (_) {}
  }
  return banner.imageUrl || '';
}

function registerAdBanners(app, { auth, adminRole, customerAuth, supabase, upload, bucket, signedUrlHelper }) {
  // Public / Customer endpoint: GET /api/customer/banners
  const customerHandler = async (req, res) => {
    try {
      const placement = req.query.placement || 'all';
      const allBanners = await loadBannersFromStorage(supabase);
      
      const activeBanners = allBanners.filter(b => b.active);
      const filtered = placement === 'all'
        ? activeBanners
        : activeBanners.filter(b => (b.placement || 'top') === placement);

      const resolved = await Promise.all(filtered.map(async b => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle || '',
        placement: b.placement || 'top',
        linkType: b.linkType || 'explore',
        linkValue: b.linkValue || '',
        active: b.active,
        displayOrder: Number(b.displayOrder || 0),
        imageUrl: await resolveBannerImageUrl(b, supabase, bucket, signedUrlHelper),
        imagePath: b.imagePath,
        createdAt: b.createdAt,
      })));

      // Sort by displayOrder ascending, then createdAt descending
      resolved.sort((a, b) => (a.displayOrder - b.displayOrder) || (new Date(b.createdAt) - new Date(a.createdAt)));

      res.json({ banners: resolved });
    } catch (err) {
      console.error('[ad-banners] Error getting customer banners:', err);
      res.status(500).json({ error: 'Failed to load banners' });
    }
  };

  app.get('/api/customer/banners', customerHandler);

  // Admin endpoints: requireAuth, adminRole
  // 1. GET /api/admin/banners
  app.get('/api/admin/banners', auth, adminRole, async (_req, res) => {
    try {
      const banners = await loadBannersFromStorage(supabase);
      const resolved = await Promise.all(banners.map(async b => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle || '',
        placement: b.placement || 'top',
        linkType: b.linkType || 'explore',
        linkValue: b.linkValue || '',
        active: Boolean(b.active),
        displayOrder: Number(b.displayOrder || 0),
        imageUrl: await resolveBannerImageUrl(b, supabase, bucket, signedUrlHelper),
        imagePath: b.imagePath,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })));

      resolved.sort((a, b) => (a.displayOrder - b.displayOrder) || (new Date(b.createdAt) - new Date(a.createdAt)));
      res.json({ banners: resolved });
    } catch (err) {
      console.error('[ad-banners] Error listing admin banners:', err);
      res.status(500).json({ error: 'Failed to retrieve ad banners' });
    }
  });

  // 2. POST /api/admin/banners (upload image + create banner)
  const uploadMiddleware = upload && typeof upload.single === 'function'
    ? upload.single('image')
    : (_req, _res, next) => next();

  app.post('/api/admin/banners', auth, adminRole, uploadMiddleware, async (req, res) => {
    try {
      const title = (req.body.title || '').trim();
      const subtitle = (req.body.subtitle || '').trim();
      const placement = ['top', 'downside', 'explore'].includes(req.body.placement)
        ? req.body.placement
        : 'top';
      const linkType = ['explore', 'merchant', 'offer', 'external'].includes(req.body.linkType)
        ? req.body.linkType
        : 'explore';
      const linkValue = (req.body.linkValue || '').trim();
      const active = req.body.active !== 'false' && req.body.active !== false;
      const displayOrder = Number(req.body.displayOrder || 0);

      if (!title) {
        return res.status(400).json({ error: 'Banner title is required.' });
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
            console.warn('[ad-banners] Supabase storage upload failed, saving fallback:', uploadErr.message);
          }
        }

        if (!imagePath) {
          // Fallback: save to public uploads directory or data URL
          const publicUploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'banners');
          try {
            if (!fs.existsSync(publicUploadsDir)) {
              fs.mkdirSync(publicUploadsDir, { recursive: true });
            }
            const localFilename = `${fileId}.${ext}`;
            fs.writeFileSync(path.join(publicUploadsDir, localFilename), req.file.buffer);
            imagePath = `/uploads/banners/${localFilename}`;
            imageUrl = imagePath;
          } catch (_) {
            // As secondary fallback, base64 data URI
            imagePath = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            imageUrl = imagePath;
          }
        }
      } else if (req.body.imageUrl) {
        imagePath = req.body.imageUrl.trim();
        imageUrl = imagePath;
      }

      if (!imagePath) {
        return res.status(400).json({ error: 'Please upload a banner image file.' });
      }

      const newBanner = {
        id: crypto.randomUUID(),
        title,
        subtitle,
        placement,
        linkType,
        linkValue,
        active,
        displayOrder,
        imagePath,
        imageUrl: imageUrl || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const banners = await loadBannersFromStorage(supabase);
      banners.unshift(newBanner);
      saveLocalBanners(banners);
      await syncToSupabase(supabase, banners);

      newBanner.imageUrl = await resolveBannerImageUrl(newBanner, supabase, bucket, signedUrlHelper);

      res.status(201).json({ success: true, banner: newBanner });
    } catch (err) {
      console.error('[ad-banners] Error creating banner:', err);
      res.status(500).json({ error: err.message || 'Failed to create banner' });
    }
  });

  // 3. PUT /api/admin/banners/:id
  app.put('/api/admin/banners/:id', auth, adminRole, uploadMiddleware, async (req, res) => {
    try {
      const bannerId = req.params.id;
      const banners = await loadBannersFromStorage(supabase);
      const index = banners.findIndex(b => b.id === bannerId);

      if (index === -1) {
        return res.status(404).json({ error: 'Banner not found.' });
      }

      const existing = banners[index];
      const title = req.body.title !== undefined ? String(req.body.title).trim() : existing.title;
      const subtitle = req.body.subtitle !== undefined ? String(req.body.subtitle).trim() : (existing.subtitle || '');
      const placement = ['top', 'downside', 'explore'].includes(req.body.placement)
        ? req.body.placement
        : existing.placement;
      const linkType = ['explore', 'merchant', 'offer', 'external'].includes(req.body.linkType)
        ? req.body.linkType
        : existing.linkType;
      const linkValue = req.body.linkValue !== undefined ? String(req.body.linkValue).trim() : (existing.linkValue || '');
      const active = req.body.active !== undefined
        ? (req.body.active !== 'false' && req.body.active !== false)
        : existing.active;
      const displayOrder = req.body.displayOrder !== undefined
        ? Number(req.body.displayOrder || 0)
        : (existing.displayOrder || 0);

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
              // Delete old image from storage if it was a supabase path
              if (existing.imagePath && existing.imagePath.startsWith('banners/')) {
                await supabase.storage.from(bucket).remove([existing.imagePath]).catch(() => {});
              }
              imagePath = storagePath;
              imageUrl = '';
            }
          } catch (_) {}
        }

        if (imagePath === existing.imagePath && req.file) {
          // Local fallback
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

      const updated = {
        ...existing,
        title,
        subtitle,
        placement,
        linkType,
        linkValue,
        active,
        displayOrder,
        imagePath,
        imageUrl: imageUrl || '',
        updatedAt: new Date().toISOString(),
      };

      banners[index] = updated;
      saveLocalBanners(banners);
      await syncToSupabase(supabase, banners);

      updated.imageUrl = await resolveBannerImageUrl(updated, supabase, bucket, signedUrlHelper);

      res.json({ success: true, banner: updated });
    } catch (err) {
      console.error('[ad-banners] Error updating banner:', err);
      res.status(500).json({ error: err.message || 'Failed to update banner' });
    }
  });

  // 4. PATCH /api/admin/banners/:id/toggle-active
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

  // 5. DELETE /api/admin/banners/:id
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

      // Clean up storage if applicable
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
      return {
        id: `banner-${b.id}`,
        bannerId: b.id,
        title: b.title,
        description: b.subtitle || '',
        rawDescription: b.subtitle || '',
        theme: 'blue',
        icon: 'gift',
        action: b.linkType === 'external' ? 'Open link' : b.linkType === 'merchant' ? 'Visit shop' : 'View banner',
        url: b.linkType === 'explore'
          ? '/customer/explore'
          : b.linkType === 'merchant'
            ? `/customer/explore?merchantId=${b.linkValue}`
            : b.linkType === 'offer'
              ? '/customer/offers'
              : (b.linkValue || '/customer/explore'),
        test: false,
        imageUrl: resolvedUrl,
        bannerImageUrl: resolvedUrl,
        offerImageUrl: resolvedUrl,
        isAdBanner: true,
        linkType: b.linkType,
        linkValue: b.linkValue,
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

