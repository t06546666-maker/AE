const crypto = require('crypto');
const { uploadFileToCloudStorage } = require('./cloud-storage.cjs');

/**
 * Register Admin Notification Management routes and background scheduler
 */
function registerAdminNotifications(app, {
  auth,
  adminRole,
  supabase,
  firebaseReady,
  uploadMiddleware,
}) {

  // Helper to ensure Firebase is ready and return db & messaging instances
  async function getFirebaseInstances() {
    const isReady = await firebaseReady();
    if (!isReady) {
      throw new Error('Firebase services are not initialized.');
    }
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    const { getMessaging } = await import('firebase-admin/messaging');
    return {
      db: getFirestore(),
      messaging: getMessaging(),
      FieldValue,
    };
  }

  /**
   * Helper to execute broadcast notification to customers and/or merchants or a specific customer
   */
  async function executeBroadcastNotification({
    title,
    body,
    url = '',
    imageUrl = '',
    target = 'customers',
    customerId = null,
    customerName = '',
    customerPhone = '',
    customerIds = null,
    customerNames = null,
    merchantIds = null,
    merchantNames = null,
    targetSummary = '',
    scheduledId = null,
    pushOnly = false,
  }) {
    const { db, messaging, FieldValue } = await getFirebaseInstances();

    // Normalize customerIds array
    let normalizedCustomerIds = [];
    if (Array.isArray(customerIds)) {
      normalizedCustomerIds = customerIds.map(String).filter(Boolean);
    } else if (typeof customerIds === 'string' && customerIds.trim()) {
      try {
        const parsed = JSON.parse(customerIds);
        if (Array.isArray(parsed)) normalizedCustomerIds = parsed.map(String).filter(Boolean);
      } catch {
        normalizedCustomerIds = customerIds.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    if (customerId && !normalizedCustomerIds.includes(String(customerId))) {
      normalizedCustomerIds.push(String(customerId));
    }

    // Normalize merchantIds array
    let normalizedMerchantIds = [];
    if (Array.isArray(merchantIds)) {
      normalizedMerchantIds = merchantIds.map(String).filter(Boolean);
    } else if (typeof merchantIds === 'string' && merchantIds.trim()) {
      try {
        const parsed = JSON.parse(merchantIds);
        if (Array.isArray(parsed)) normalizedMerchantIds = parsed.map(String).filter(Boolean);
      } catch {
        normalizedMerchantIds = merchantIds.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    // Customer name lookup map if object provided
    let customerNameMap = {};
    if (customerNames && typeof customerNames === 'object') {
      customerNameMap = customerNames;
    }

    // 1. Save in customer in-app notifications (skipped if pushOnly mode)
    if (!pushOnly) {
      // If targeted to specific selected customers
      if (target === 'selected_customers' || target === 'single_customer') {
        try {
          await Promise.all(
            normalizedCustomerIds.map(async (cId) => {
              try {
                await db.collection('ae_customer_announcements').add({
                  title,
                  body,
                  url: url || '',
                  image_url: imageUrl || '',
                  target: 'selected_customers',
                  customer_id: String(cId),
                  customer_name: (customerNameMap && customerNameMap[cId]) || (cId === customerId ? customerName : '') || '',
                  customer_phone: (cId === customerId ? customerPhone : '') || '',
                  created_at: FieldValue.serverTimestamp(),
                });
              } catch (err) {
                console.warn(`[admin-notifications] Error saving announcement for customer ${cId}:`, err.message);
              }
            })
          );
        } catch (saveErr) {
          console.warn('[admin-notifications] Error saving selected customer in-app announcements:', saveErr.message);
        }
      } else if (target === 'customers' || target === 'all') {
        try {
          await db.collection('ae_customer_announcements').add({
            title,
            body,
            url: url || '',
            image_url: imageUrl || '',
            target,
            created_at: FieldValue.serverTimestamp(),
          });
        } catch (saveErr) {
          console.warn('[admin-notifications] Error saving in-app announcement:', saveErr.message);
        }
      }

      // 1b. Save in merchant inboxes so onboarded merchants receive it in their notification bell
      if (target === 'selected_merchants' && normalizedMerchantIds.length > 0) {
        try {
          await db.collection('ae_merchant_announcements').add({
            title,
            body,
            url: url || '',
            image_url: imageUrl || '',
            target: 'selected_merchants',
            merchant_ids: normalizedMerchantIds,
            created_at: FieldValue.serverTimestamp(),
          });
        } catch (saveErr) {
          console.warn('[admin-notifications] Error saving selected merchant announcement:', saveErr.message);
        }

        try {
          const targetProfileIds = new Set();
          normalizedMerchantIds.forEach((mId) => targetProfileIds.add(mId));

          if (supabase) {
            const { data: mProfiles } = await supabase
              .from('profiles')
              .select('id, merchant_id')
              .eq('role', 'merchant');
            if (Array.isArray(mProfiles)) {
              mProfiles.forEach((p) => {
                if (p.merchant_id && normalizedMerchantIds.includes(String(p.merchant_id))) {
                  targetProfileIds.add(p.id);
                }
              });
            }
          }

          const profileSnap = await db.collection('ae_profile_push_registrations').get();
          profileSnap.forEach((doc) => {
            const data = doc.data();
            if (data && data.merchant_id && normalizedMerchantIds.includes(String(data.merchant_id))) {
              targetProfileIds.add(doc.id);
            }
          });

          const uniqueProfileIds = Array.from(targetProfileIds);
          await Promise.all(
            uniqueProfileIds.map(async (pId) => {
              try {
                await db
                  .collection('ae_profile_notification_inboxes')
                  .doc(pId)
                  .collection('items')
                  .add({
                    title: String(title).slice(0, 160),
                    body: String(body).slice(0, 1000),
                    target_url: typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url.slice(0, 500) : null,
                    image_url: imageUrl || null,
                    event_type: 'admin_broadcast',
                    entity_id: null,
                    read_at: null,
                    created_at: new Date().toISOString(),
                  });
              } catch {
                // Ignore individual inbox save error
              }
            })
          );
        } catch (inboxErr) {
          console.warn('[admin-notifications] Error saving selected merchant inboxes:', inboxErr.message);
        }
      } else if (target === 'merchants' || target === 'all') {
        try {
          await db.collection('ae_merchant_announcements').add({
            title,
            body,
            url: url || '',
            image_url: imageUrl || '',
            target,
            created_at: FieldValue.serverTimestamp(),
          });
        } catch (saveErr) {
          console.warn('[admin-notifications] Error saving merchant announcement:', saveErr.message);
        }

        try {
          const merchantProfileIds = new Set();
          if (supabase) {
            const { data: mProfiles } = await supabase.from('profiles').select('id').eq('role', 'merchant');
            if (Array.isArray(mProfiles)) {
              mProfiles.forEach((p) => merchantProfileIds.add(p.id));
            }
          }
          const profileSnap = await db.collection('ae_profile_push_registrations').get();
          profileSnap.forEach((doc) => {
            const data = doc.data();
            if (data && (data.role === 'merchant' || !data.role)) {
              merchantProfileIds.add(doc.id);
            }
          });
          const uniqueIds = Array.from(merchantProfileIds);
          await Promise.all(
            uniqueIds.map(async (mId) => {
              try {
                await db
                  .collection('ae_profile_notification_inboxes')
                  .doc(mId)
                  .collection('items')
                  .add({
                    title: String(title).slice(0, 160),
                    body: String(body).slice(0, 1000),
                    target_url: typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url.slice(0, 500) : null,
                    image_url: imageUrl || null,
                    event_type: 'admin_broadcast',
                    entity_id: null,
                    read_at: null,
                    created_at: new Date().toISOString(),
                  });
              } catch {
                // Ignore individual inbox save error
              }
            })
          );
        } catch (inboxErr) {
          console.warn('[admin-notifications] Error saving merchant inboxes:', inboxErr.message);
        }
      }
    }

    // 2. Collect eligible push tokens
    const tokens = [];

    // Target: Selected customers or Single customer
    if ((target === 'selected_customers' || target === 'single_customer') && normalizedCustomerIds.length > 0) {
      await Promise.all(
        normalizedCustomerIds.map(async (cId) => {
          try {
            const custDoc = await db.collection('ae_customer_notifications').doc(String(cId)).get();
            if (custDoc.exists) {
              const data = custDoc.data();
              if (data && data.push_token && data.push_enabled !== false) {
                tokens.push(data.push_token);
              }
            }
          } catch (scErr) {
            console.warn(`[admin-notifications] Error reading specific customer token for ${cId}:`, scErr.message);
          }
        })
      );
    }

    // Target: All customers
    if (target === 'customers' || target === 'all') {
      try {
        const customerSnap = await db.collection('ae_customer_notifications').get();
        customerSnap.forEach((doc) => {
          const data = doc.data();
          if (data.push_token && data.push_enabled !== false) {
            tokens.push(data.push_token);
          }
        });
      } catch (cErr) {
        console.warn('[admin-notifications] Error reading customer tokens:', cErr.message);
      }
    }

    // Target: Selected merchants
    if (target === 'selected_merchants' && normalizedMerchantIds.length > 0) {
      // 1. From Firestore ae_profile_push_registrations
      try {
        const profilePushSnap = await db.collection('ae_profile_push_registrations').get();
        profilePushSnap.forEach((doc) => {
          const data = doc.data();
          if (data && data.push_token && data.push_enabled !== false) {
            const matchesId = normalizedMerchantIds.includes(String(doc.id)) ||
              (data.merchant_id && normalizedMerchantIds.includes(String(data.merchant_id)));
            if (matchesId) {
              tokens.push(data.push_token);
            }
          }
        });
      } catch (pErr) {
        console.warn('[admin-notifications] Error reading selected merchant tokens from Firestore:', pErr.message);
      }

      // 2. From Supabase profiles
      if (supabase) {
        try {
          const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, merchant_id, push_token, push_enabled, role')
            .eq('role', 'merchant');
          if (!error && Array.isArray(profiles)) {
            profiles.forEach((p) => {
              const matchesId = normalizedMerchantIds.includes(String(p.id)) ||
                (p.merchant_id && normalizedMerchantIds.includes(String(p.merchant_id)));
              if (matchesId && p.push_token && p.push_enabled !== false) {
                tokens.push(p.push_token);
              }
            });
          }
        } catch (mErr) {
          console.warn('[admin-notifications] Error reading selected merchant tokens from Supabase:', mErr.message);
        }
      }
    }

    // Target: All merchants
    if (target === 'merchants' || target === 'all') {
      // 1. From Firestore ae_profile_push_registrations (primary source)
      try {
        const profilePushSnap = await db.collection('ae_profile_push_registrations').get();
        profilePushSnap.forEach((doc) => {
          const data = doc.data();
          if (data && data.push_token && data.push_enabled !== false) {
            if (target === 'all' || data.role === 'merchant') {
              tokens.push(data.push_token);
            }
          }
        });
      } catch (pErr) {
        console.warn('[admin-notifications] Error reading profile push tokens from Firestore:', pErr.message);
      }

      // 2. From Supabase profiles (compatibility fallback)
      if (supabase) {
        try {
          const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, push_token, push_enabled, role')
            .eq('role', 'merchant');
          if (!error && Array.isArray(profiles)) {
            profiles.forEach((p) => {
              if (p.push_token && p.push_enabled !== false) {
                tokens.push(p.push_token);
              }
            });
          }
        } catch (mErr) {
          console.warn('[admin-notifications] Error reading merchant tokens from Supabase:', mErr.message);
        }
      }
    }

    const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));

    if (uniqueTokens.length === 0) {
      // Record history even if 0 push devices found (notification is still saved in in-app inbox if not push-only)
      try {
        await db.collection('ae_notification_history').add({
          title,
          body,
          url: url || '',
          image_url: imageUrl || '',
          target,
          push_only: Boolean(pushOnly),
          customer_id: customerId || (normalizedCustomerIds[0] || null),
          customer_name: customerName || '',
          customer_phone: customerPhone || '',
          customer_ids: normalizedCustomerIds,
          merchant_ids: normalizedMerchantIds,
          target_summary: targetSummary || '',
          target_count: normalizedCustomerIds.length || normalizedMerchantIds.length || 0,
          scheduled_id: scheduledId || null,
          sent_at: FieldValue.serverTimestamp(),
          delivered: 0,
          failed: 0,
          total: 0,
        });
      } catch (hErr) {
        console.warn('[admin-notifications] Error saving empty history:', hErr.message);
      }

      return {
        success: true,
        delivered: 0,
        failed: 0,
        total: 0,
      };
    }

    // 3. Prepare FCM message batch
    const messages = uniqueTokens.map((token) => ({
      token,
      notification: {
        title,
        body,
        ...(imageUrl ? { imageUrl } : {}),
      },
      data: Object.fromEntries(
        Object.entries({
          url: url || (pushOnly ? '' : (target === 'merchants' ? '/dashboard' : (imageUrl ? `/customer/notifications?viewImage=${encodeURIComponent(imageUrl)}` : '/customer/notifications'))),
          imageUrl: imageUrl || '',
          type: 'announcement',
          push_only: pushOnly ? 'true' : 'false',
        }).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          channelId: 'ae_notifications',
          sound: 'default',
          ...(imageUrl ? { imageUrl } : {}),
        },
      },
      ...(imageUrl
        ? {
            apns: {
              payload: {
                aps: {
                  'mutable-content': 1,
                },
              },
              fcm_options: {
                image: imageUrl,
              },
            },
          }
        : {}),
    }));

    // 4. Send FCM messages in batches of 500
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < messages.length; i += 500) {
      const chunk = messages.slice(i, i + 500);
      try {
        const response = await messaging.sendEach(chunk);
        successCount += response.successCount;
        failureCount += response.failureCount;

        response.responses.forEach((r, idx) => {
          if (!r.success) {
            console.warn(`[admin-notifications] FCM Token error (${chunk[idx].token.slice(0, 10)}...):`, r.error?.message);
          }
        });
      } catch (batchErr) {
        console.error('[admin-notifications] Batch send error:', batchErr.message);
        failureCount += chunk.length;
      }
    }

    // 5. Save broadcast record into history
    try {
      await db.collection('ae_notification_history').add({
        title,
        body,
        url: url || '',
        image_url: imageUrl || '',
        target,
        push_only: Boolean(pushOnly),
        customer_id: customerId || (normalizedCustomerIds[0] || null),
        customer_name: customerName || '',
        customer_phone: customerPhone || '',
        customer_ids: normalizedCustomerIds,
        merchant_ids: normalizedMerchantIds,
        target_summary: targetSummary || '',
        target_count: normalizedCustomerIds.length || normalizedMerchantIds.length || 0,
        scheduled_id: scheduledId || null,
        sent_at: FieldValue.serverTimestamp(),
        delivered: successCount,
        failed: failureCount,
        total: uniqueTokens.length,
      });
    } catch (hErr) {
      console.warn('[admin-notifications] Error saving broadcast history:', hErr.message);
    }

    return {
      success: true,
      delivered: successCount,
      failed: failureCount,
      total: uniqueTokens.length,
    };
  }

  /**
   * Background runner for scheduled notifications
   * Checks every 30 seconds for pending scheduled notifications whose scheduled_at <= now
   */
  async function processScheduledNotifications() {
    try {
      const isReady = await firebaseReady();
      if (!isReady) return;

      const { db, FieldValue } = await getFirebaseInstances();
      const nowIso = new Date().toISOString();

      const snapshot = await db
        .collection('ae_scheduled_notifications')
        .where('status', '==', 'scheduled')
        .where('scheduled_at', '<=', nowIso)
        .limit(10)
        .get();

      if (snapshot.empty) return;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        console.log(`[admin-notifications-scheduler] Processing scheduled push: ${doc.id} ("${data.title}")`);

        // Lock document to 'processing' to prevent concurrent execution
        await doc.ref.update({
          status: 'processing',
          processing_at: FieldValue.serverTimestamp(),
        });

        try {
          const result = await executeBroadcastNotification({
            title: data.title,
            body: data.body,
            url: data.url || '',
            imageUrl: data.image_url || '',
            target: data.target || 'customers',
            customerId: data.customer_id || null,
            customerName: data.customer_name || '',
            customerPhone: data.customer_phone || '',
            customerIds: data.customer_ids || (data.customer_id ? [data.customer_id] : []),
            customerNames: data.customer_names || null,
            merchantIds: data.merchant_ids || [],
            merchantNames: data.merchant_names || null,
            targetSummary: data.target_summary || '',
            scheduledId: doc.id,
            pushOnly: Boolean(data.push_only || data.pushOnly),
          });

          await doc.ref.update({
            status: 'sent',
            sent_at: FieldValue.serverTimestamp(),
            delivered: result.delivered,
            failed: result.failed,
            total: result.total,
          });

          console.log(`[admin-notifications-scheduler] Successfully dispatched scheduled push ${doc.id} (${result.delivered}/${result.total} delivered).`);
        } catch (sendErr) {
          console.error(`[admin-notifications-scheduler] Failed sending scheduled push ${doc.id}:`, sendErr.message);
          await doc.ref.update({
            status: 'failed',
            error: sendErr.message,
            failed_at: FieldValue.serverTimestamp(),
          });
        }
      }
    } catch (schedErr) {
      // Don't crash server on scheduler loop error
      console.warn('[admin-notifications-scheduler] Loop check warning:', schedErr.message);
    }
  }

  // Start background interval (runs every 30 seconds)
  const schedulerTimer = setInterval(processScheduledNotifications, 30000);
  if (schedulerTimer.unref) schedulerTimer.unref();

  // ----------------------------------------------------
  // API ROUTES
  // ----------------------------------------------------

  /**
   * GET /api/admin/customers/search-push
   * Search customers by name, phone, or customer code and return their active push status
   */
  app.get('/api/admin/customers/search-push', auth, adminRole, async (req, res) => {
    try {
      const q = (req.query.q || '').trim();
      if (!q || q.length < 1) {
        return res.json({ success: true, customers: [] });
      }

      if (!supabase) {
        return res.status(500).json({ success: false, error: 'Database is unavailable' });
      }

      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, name, phone, customer_code, created_at')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%,customer_code.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      const { db } = await getFirebaseInstances();

      // Check push status in Firestore for each matching customer
      const enriched = await Promise.all(
        (customers || []).map(async (c) => {
          let hasPushToken = false;
          try {
            const doc = await db.collection('ae_customer_notifications').doc(String(c.id)).get();
            const d = doc.data();
            hasPushToken = Boolean(d && d.push_token && d.push_enabled !== false);
          } catch (e) {
            // Ignore individual token read error
          }
          return {
            id: c.id,
            name: c.name || 'Customer',
            phone: c.phone || '',
            customer_code: c.customer_code || '',
            hasPushToken,
          };
        })
      );

      res.json({ success: true, customers: enriched });
    } catch (err) {
      console.error('[admin-notifications] Customer push search error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/admin/merchants/push-status
   * Returns complete list of onboarded merchants and their live push notification connectivity
   */
  app.get('/api/admin/merchants/push-status', auth, adminRole, async (_req, res) => {
    try {
      if (!supabase) {
        return res.status(500).json({ success: false, error: 'Database is unavailable' });
      }

      const { data: merchants, error } = await supabase
        .from('active_merchants')
        .select('id, merchant_code, name, phone, email, created_at')
        .order('name');

      if (error) throw error;

      // Profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, merchant_id, email, push_token, push_enabled')
        .eq('role', 'merchant');

      // Firestore push registrations
      const { db } = await getFirebaseInstances();
      const fireTokensByMerchantId = new Map();
      const fireTokensByProfileId = new Map();
      try {
        const pSnap = await db.collection('ae_profile_push_registrations').get();
        pSnap.forEach((doc) => {
          const d = doc.data();
          if (d && d.push_token && d.push_enabled !== false) {
            if (d.merchant_id) fireTokensByMerchantId.set(d.merchant_id, d);
            fireTokensByProfileId.set(doc.id, d);
          }
        });
      } catch (fErr) {
        console.warn('Firestore merchant push status error:', fErr.message);
      }

      const profileByMerchantId = new Map();
      (profiles || []).forEach((p) => {
        if (p.merchant_id) profileByMerchantId.set(p.merchant_id, p);
      });

      const list = (merchants || []).map((m) => {
        const prof = profileByMerchantId.get(m.id);
        const fireDoc = fireTokensByMerchantId.get(m.id) || (prof ? fireTokensByProfileId.get(prof.id) : null);
        const hasToken = Boolean(
          (prof && prof.push_token && prof.push_enabled !== false) ||
          fireDoc
        );

        return {
          id: m.id,
          merchant_code: m.merchant_code || '',
          name: m.name,
          phone: m.phone,
          email: m.email,
          hasPushToken: hasToken,
          status: hasToken ? 'active' : 'pending',
          updated_at: fireDoc?.updated_at || null,
        };
      });

      const activeCount = list.filter((m) => m.hasPushToken).length;

      res.json({
        success: true,
        summary: {
          total: list.length,
          active: activeCount,
          pending: list.length - activeCount,
        },
        merchants: list,
      });
    } catch (err) {
      console.error('[admin-notifications] Merchant push status error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/admin/notifications/stats
   * Returns active device counts
   */
  app.get('/api/admin/notifications/stats', auth, adminRole, async (_req, res) => {
    try {
      const { db } = await getFirebaseInstances();

      let customerTokensCount = 0;
      try {
        const custSnap = await db.collection('ae_customer_notifications').get();
        custSnap.forEach((doc) => {
          const d = doc.data();
          if (d.push_token && d.push_enabled !== false) {
            customerTokensCount++;
          }
        });
      } catch (cErr) {
        console.warn('Customer stats error:', cErr.message);
      }

      // Merchant push tokens (from Firestore ae_profile_push_registrations + Supabase)
      const merchantTokens = new Set();
      try {
        const pSnap = await db.collection('ae_profile_push_registrations').get();
        pSnap.forEach((doc) => {
          const d = doc.data();
          if (d.push_token && d.push_enabled !== false && d.role === 'merchant') {
            merchantTokens.add(d.push_token);
          }
        });
      } catch (pErr) {
        console.warn('Profile push stats error:', pErr.message);
      }

      if (supabase) {
        try {
          const { data: merchants } = await supabase
            .from('profiles')
            .select('id, push_token, push_enabled')
            .eq('role', 'merchant');
          (merchants || []).forEach((m) => {
            if (m.push_token && m.push_enabled !== false) {
              merchantTokens.add(m.push_token);
            }
          });
        } catch (mErr) {
          console.warn('Merchant stats error:', mErr.message);
        }
      }

      // Total onboarded customers & merchants count for clear context
      let totalOnboardedCustomers = 0;
      let totalOnboardedMerchants = 0;
      if (supabase) {
        try {
          const [{ count: cCount }, { count: mCount }] = await Promise.all([
            supabase.from('customers').select('id', { count: 'exact', head: true }),
            supabase.from('active_merchants').select('id', { count: 'exact', head: true }),
          ]);
          totalOnboardedCustomers = cCount || 0;
          totalOnboardedMerchants = mCount || 0;
        } catch (countErr) {
          console.warn('Onboarded count error:', countErr.message);
        }
      }

      res.json({
        success: true,
        customerTokens: customerTokensCount,
        totalOnboardedCustomers,
        merchantTokens: merchantTokens.size,
        totalOnboardedMerchants,
        totalTokens: customerTokensCount + merchantTokens.size,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/admin/notifications/history
   * Lists recent broadcast history & scheduled queue
   */
  app.get('/api/admin/notifications/history', auth, adminRole, async (_req, res) => {
    try {
      const { db } = await getFirebaseInstances();

      // 1. Fetch scheduled
      const scheduledSnap = await db
        .collection('ae_scheduled_notifications')
        .where('status', 'in', ['scheduled', 'processing'])
        .orderBy('scheduled_at', 'asc')
        .limit(30)
        .get();

      const scheduled = scheduledSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title || '',
          body: d.body || '',
          url: d.url || '',
          image_url: d.image_url || '',
          target: d.target || 'customers',
          push_only: Boolean(d.push_only || d.pushOnly),
          customer_id: d.customer_id || null,
          customer_name: d.customer_name || '',
          customer_phone: d.customer_phone || '',
          customer_ids: d.customer_ids || [],
          merchant_ids: d.merchant_ids || [],
          target_summary: d.target_summary || '',
          target_count: Number(d.target_count || (d.customer_ids?.length) || (d.merchant_ids?.length) || 0),
          scheduled_at: d.scheduled_at,
          status: d.status || 'scheduled',
          created_at: d.created_at?.toDate ? d.created_at.toDate().toISOString() : d.created_at,
        };
      });

      // 2. Fetch past broadcast history
      const historySnap = await db
        .collection('ae_notification_history')
        .orderBy('sent_at', 'desc')
        .limit(40)
        .get();

      const history = historySnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title || '',
          body: d.body || '',
          url: d.url || '',
          image_url: d.image_url || '',
          target: d.target || 'customers',
          push_only: Boolean(d.push_only || d.pushOnly),
          customer_id: d.customer_id || null,
          customer_name: d.customer_name || '',
          customer_phone: d.customer_phone || '',
          customer_ids: d.customer_ids || [],
          merchant_ids: d.merchant_ids || [],
          target_summary: d.target_summary || '',
          target_count: Number(d.target_count || (d.customer_ids?.length) || (d.merchant_ids?.length) || 0),
          scheduled_id: d.scheduled_id || null,
          delivered: Number(d.delivered || 0),
          failed: Number(d.failed || 0),
          total: Number(d.total || 0),
          sent_at: d.sent_at?.toDate ? d.sent_at.toDate().toISOString() : d.sent_at,
        };
      });

      res.json({
        success: true,
        scheduled,
        history,
      });
    } catch (err) {
      console.error('[admin-notifications] History fetch error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/admin/broadcast-notification
   * Broadcast immediately or schedule for future date/time
   * Supports target: 'customers' | 'selected_customers' | 'merchants' | 'selected_merchants' | 'all' | 'single_customer'
   */
  app.post('/api/admin/broadcast-notification', auth, adminRole, uploadMiddleware, async (req, res) => {
    try {
      const title = (req.body.title || '').trim();
      const body = (req.body.body || '').trim();
      const url = (req.body.url || '').trim();
      const target = (req.body.target || 'customers').trim();
      const customerId = (req.body.customerId || req.body.customer_id || '').trim();
      const customerName = (req.body.customerName || req.body.customer_name || '').trim();
      const customerPhone = (req.body.customerPhone || req.body.customer_phone || '').trim();
      const targetSummary = (req.body.targetSummary || req.body.target_summary || '').trim();
      const scheduledAtRaw = (req.body.scheduled_at || '').trim();
      const pushOnly = req.body.pushOnly === true || req.body.pushOnly === 'true' || req.body.push_only === true || req.body.push_only === 'true';

      // Parse multi-select customer IDs
      let customerIds = [];
      if (req.body.customerIds) {
        try {
          customerIds = typeof req.body.customerIds === 'string' ? JSON.parse(req.body.customerIds) : req.body.customerIds;
        } catch {
          customerIds = String(req.body.customerIds).split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      if (!Array.isArray(customerIds)) customerIds = [];
      if (customerId && !customerIds.includes(customerId)) {
        customerIds.push(customerId);
      }

      // Parse multi-select merchant IDs
      let merchantIds = [];
      if (req.body.merchantIds) {
        try {
          merchantIds = typeof req.body.merchantIds === 'string' ? JSON.parse(req.body.merchantIds) : req.body.merchantIds;
        } catch {
          merchantIds = String(req.body.merchantIds).split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      if (!Array.isArray(merchantIds)) merchantIds = [];
      if (req.body.merchantId && !merchantIds.includes(req.body.merchantId)) {
        merchantIds.push(req.body.merchantId);
      }

      if (!title) {
        return res.status(400).json({ success: false, error: 'Notification title is required.' });
      }
      if (!body) {
        return res.status(400).json({ success: false, error: 'Notification message body is required.' });
      }

      if ((target === 'selected_customers' || target === 'single_customer') && customerIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Please select at least one customer to send this notification to.' });
      }

      if (target === 'selected_merchants' && merchantIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Please select at least one merchant to send this notification to.' });
      }

      // Handle optional image upload
      let imageUrl = (req.body.imageUrl || req.body.image_url || '').trim();
      if (req.file) {
        const mimeType = req.file.mimetype || 'image/jpeg';
        const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
        const cloudPath = `announcements/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
        imageUrl = await uploadFileToCloudStorage(cloudPath, req.file.buffer, mimeType);
      }

      // Check if scheduled
      let isScheduled = false;
      let scheduledAtIso = null;

      if (scheduledAtRaw) {
        const scheduledTime = new Date(scheduledAtRaw).getTime();
        if (Number.isFinite(scheduledTime) && scheduledTime > Date.now()) {
          isScheduled = true;
          scheduledAtIso = new Date(scheduledTime).toISOString();
        }
      }

      const { db, FieldValue } = await getFirebaseInstances();

      if (isScheduled) {
        // Save to scheduled notifications collection
        const docRef = await db.collection('ae_scheduled_notifications').add({
          title,
          body,
          url: url || '',
          image_url: imageUrl || '',
          target,
          push_only: pushOnly,
          customer_id: customerId || (customerIds[0] || null),
          customer_name: customerName || '',
          customer_phone: customerPhone || '',
          customer_ids: customerIds,
          merchant_ids: merchantIds,
          target_summary: targetSummary || '',
          target_count: customerIds.length || merchantIds.length || 0,
          scheduled_at: scheduledAtIso,
          status: 'scheduled',
          created_at: FieldValue.serverTimestamp(),
        });

        let targetDesc = 'audience';
        if (target === 'selected_customers' || target === 'single_customer') {
          targetDesc = targetSummary || `${customerIds.length} selected customer(s)`;
        } else if (target === 'selected_merchants') {
          targetDesc = targetSummary || `${merchantIds.length} selected merchant(s)`;
        }

        return res.json({
          success: true,
          scheduled: true,
          id: docRef.id,
          scheduled_at: scheduledAtIso,
          message: `Push notification for ${targetDesc} scheduled for ${new Date(scheduledAtIso).toLocaleString('en-IN')}`,
        });
      }

      // Send immediately
      const result = await executeBroadcastNotification({
        title,
        body,
        url,
        imageUrl,
        target,
        customerId,
        customerName,
        customerPhone,
        customerIds,
        merchantIds,
        targetSummary,
        pushOnly,
      });

      let responseMsg = '';
      if (pushOnly) {
        responseMsg = result.delivered > 0
          ? `Push notification sent directly to ${result.delivered} device(s) (Phone push only - not saved to in-app feed).`
          : 'Push notification attempted (0 devices registered at this time). Phone push only mode.';
      } else if (target === 'selected_customers' || target === 'single_customer') {
        const cCount = customerIds.length || 1;
        responseMsg = result.delivered > 0
          ? `Push notification successfully delivered to ${result.delivered} of ${cCount} selected customer phone(s)!`
          : `Saved to in-app notification inbox for ${cCount} selected customer(s).`;
      } else if (target === 'selected_merchants') {
        const mCount = merchantIds.length;
        responseMsg = result.delivered > 0
          ? `Push notification successfully delivered to ${result.delivered} of ${mCount} selected merchant phone(s)!`
          : `Saved to in-app notification inbox for ${mCount} selected store(s).`;
      } else {
        responseMsg = result.total > 0
          ? `Notification successfully broadcast to ${result.delivered} device(s)!`
          : 'Notification saved to in-app inbox. (No active push devices were registered at this time)';
      }

      return res.json({
        success: true,
        scheduled: false,
        delivered: result.delivered,
        failed: result.failed,
        total: result.total,
        message: responseMsg,
      });
    } catch (err) {
      console.error('[admin-notifications] Broadcast error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to send notification' });
    }
  });

  /**
   * DELETE /api/admin/notifications/scheduled/:id
   * Cancel a scheduled notification
   */
  app.delete('/api/admin/notifications/scheduled/:id', auth, adminRole, async (req, res) => {
    try {
      const { id } = req.params;
      const { db } = await getFirebaseInstances();

      const docRef = db.collection('ae_scheduled_notifications').doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, error: 'Scheduled notification not found' });
      }

      await docRef.delete();
      return res.json({ success: true, message: 'Scheduled notification cancelled successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * DELETE /api/admin/notifications/history/:id
   * Delete a past broadcast from history AND clean up corresponding in-app announcements
   */
  app.delete('/api/admin/notifications/history/:id', auth, adminRole, async (req, res) => {
    try {
      const { id } = req.params;
      const { db } = await getFirebaseInstances();

      const docRef = db.collection('ae_notification_history').doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, error: 'Broadcast history item not found' });
      }

      const data = doc.data() || {};
      const title = data.title || '';
      const imageUrl = data.image_url || '';

      await docRef.delete();

      let deletedInAppCount = 0;
      if (title) {
        const cSnap = await db.collection('ae_customer_announcements').where('title', '==', title).get();
        for (const d of cSnap.docs) {
          await d.ref.delete();
          deletedInAppCount++;
        }
        const mSnap = await db.collection('ae_merchant_announcements').where('title', '==', title).get();
        for (const d of mSnap.docs) {
          await d.ref.delete();
          deletedInAppCount++;
        }
      } else if (imageUrl) {
        const cSnap = await db.collection('ae_customer_announcements').where('image_url', '==', imageUrl).get();
        for (const d of cSnap.docs) {
          await d.ref.delete();
          deletedInAppCount++;
        }
      }

      return res.json({
        success: true,
        message: `Broadcast deleted successfully.${deletedInAppCount > 0 ? ` Also removed ${deletedInAppCount} matching announcement(s) from app inboxes.` : ''}`,
      });
    } catch (err) {
      console.error('[admin-notifications] Delete history error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  registerAdminNotifications,
};
