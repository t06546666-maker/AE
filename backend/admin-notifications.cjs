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
    scheduledId = null,
  }) {
    const { db, messaging, FieldValue } = await getFirebaseInstances();

    // 1. Save in customer in-app notifications
    // If targeted to a single customer, store customer_id so only they receive it
    if (target === 'single_customer' && customerId) {
      try {
        await db.collection('ae_customer_announcements').add({
          title,
          body,
          url: url || '',
          image_url: imageUrl || '',
          target: 'single_customer',
          customer_id: String(customerId),
          customer_name: customerName || '',
          customer_phone: customerPhone || '',
          created_at: FieldValue.serverTimestamp(),
        });
      } catch (saveErr) {
        console.warn('[admin-notifications] Error saving single customer in-app announcement:', saveErr.message);
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

    // 2. Collect eligible push tokens
    const tokens = [];

    // Target: Single specific customer
    if (target === 'single_customer' && customerId) {
      try {
        const custDoc = await db.collection('ae_customer_notifications').doc(String(customerId)).get();
        if (custDoc.exists) {
          const data = custDoc.data();
          if (data && data.push_token && data.push_enabled !== false) {
            tokens.push(data.push_token);
          }
        }
      } catch (scErr) {
        console.warn('[admin-notifications] Error reading specific customer token:', scErr.message);
      }
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

    // Target: All merchants
    if ((target === 'merchants' || target === 'all') && supabase) {
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
        console.warn('[admin-notifications] Error reading merchant tokens:', mErr.message);
      }
    }

    const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));

    if (uniqueTokens.length === 0) {
      // Record history even if 0 push devices found (notification is still saved in in-app inbox)
      try {
        await db.collection('ae_notification_history').add({
          title,
          body,
          url: url || '',
          image_url: imageUrl || '',
          target,
          customer_id: customerId || null,
          customer_name: customerName || '',
          customer_phone: customerPhone || '',
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
          url: url || '/customer/notifications',
          imageUrl: imageUrl || '',
          type: 'announcement',
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
        customer_id: customerId || null,
        customer_name: customerName || '',
        customer_phone: customerPhone || '',
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
            scheduledId: doc.id,
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
        .limit(10);

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

      let merchantTokensCount = 0;
      if (supabase) {
        try {
          const { data: merchants } = await supabase
            .from('profiles')
            .select('id, push_token, push_enabled')
            .eq('role', 'merchant');
          merchantTokensCount = (merchants || []).filter((m) => m.push_token && m.push_enabled !== false).length;
        } catch (mErr) {
          console.warn('Merchant stats error:', mErr.message);
        }
      }

      res.json({
        success: true,
        customerTokens: customerTokensCount,
        merchantTokens: merchantTokensCount,
        totalTokens: customerTokensCount + merchantTokensCount,
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
          customer_id: d.customer_id || null,
          customer_name: d.customer_name || '',
          customer_phone: d.customer_phone || '',
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
          customer_id: d.customer_id || null,
          customer_name: d.customer_name || '',
          customer_phone: d.customer_phone || '',
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
   * Supports target: 'customers' | 'merchants' | 'all' | 'single_customer'
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
      const scheduledAtRaw = (req.body.scheduled_at || '').trim();

      if (!title) {
        return res.status(400).json({ success: false, error: 'Notification title is required.' });
      }
      if (!body) {
        return res.status(400).json({ success: false, error: 'Notification message body is required.' });
      }

      if (target === 'single_customer' && !customerId) {
        return res.status(400).json({ success: false, error: 'Please select a customer to send this notification to.' });
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
          customer_id: customerId || null,
          customer_name: customerName || '',
          customer_phone: customerPhone || '',
          scheduled_at: scheduledAtIso,
          status: 'scheduled',
          created_at: FieldValue.serverTimestamp(),
        });

        const targetDesc = target === 'single_customer' ? (customerName || 'customer') : 'audience';
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
      });

      let responseMsg = '';
      if (target === 'single_customer') {
        responseMsg = result.delivered > 0
          ? `Push notification delivered to ${customerName || 'customer'}'s phone!`
          : `Saved to ${customerName || 'customer'}'s in-app inbox. (Phone app not currently registered for push)`;
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
}

module.exports = {
  registerAdminNotifications,
};
