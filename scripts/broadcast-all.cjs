require('dotenv').config();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('firebase-service-account.json not found!');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
let app = getApps().length > 0 ? getApps()[0] : null;
if (!app) {
  app = initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore(app);
const messaging = getMessaging(app);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const TITLE = 'Welcome to AE Notifications! 🔔';
const BODY = 'Keep AE notifications turned ON to receive instant cashback alerts, reward points, and exclusive store offers right on your phone!';
const URL_LINK = '/customer/notifications';

async function main() {
  console.log('========================================================');
  console.log('  Broadcasting Notification to ALL Customers & Merchants');
  console.log('========================================================');
  console.log('Title:', TITLE);
  console.log('Body :', BODY);
  console.log('');

  // 1. In-App Announcements for Customers
  console.log('1. Saving in-app customer announcement...');
  const custAnnounceRef = await db.collection('ae_customer_announcements').add({
    title: TITLE,
    body: BODY,
    url: URL_LINK,
    target: 'all',
    created_at: FieldValue.serverTimestamp(),
  });
  console.log('   ✓ Customer announcement saved (ID:', custAnnounceRef.id, ')');

  // 2. In-App Announcements for Merchants
  console.log('2. Saving in-app merchant announcement & inboxes...');
  await db.collection('ae_merchant_announcements').add({
    title: TITLE,
    body: BODY,
    url: '/dashboard',
    target: 'all',
    created_at: FieldValue.serverTimestamp(),
  });

  // Save to each merchant profile inbox
  const merchantProfileIds = new Set();
  if (supabase) {
    const { data: mProfiles } = await supabase.from('profiles').select('id').eq('role', 'merchant');
    if (Array.isArray(mProfiles)) {
      mProfiles.forEach(p => merchantProfileIds.add(p.id));
    }
  }
  const profSnap = await db.collection('ae_profile_push_registrations').get();
  profSnap.forEach(d => {
    const data = d.data();
    if (data && (data.role === 'merchant' || !data.role)) merchantProfileIds.add(d.id);
  });

  const uniqueMerchantIds = Array.from(merchantProfileIds);
  console.log(`   Delivering to ${uniqueMerchantIds.length} onboarded merchant inboxes...`);
  await Promise.all(uniqueMerchantIds.map(async (mId) => {
    try {
      await db.collection('ae_profile_notification_inboxes').doc(mId).collection('items').add({
        title: TITLE,
        body: BODY,
        target_url: '/dashboard',
        event_type: 'admin_broadcast',
        read_at: null,
        created_at: new Date().toISOString(),
      });
    } catch (e) {}
  }));
  console.log('   ✓ Delivered to all merchant inboxes.');

  // 3. Collect Customer Tokens
  console.log('\n3. Collecting Customer Push Tokens...');
  const custTokens = [];
  const custSnap = await db.collection('ae_customer_notifications').get();
  custSnap.forEach(d => {
    const data = d.data();
    if (data.push_token && data.push_enabled !== false) {
      custTokens.push(data.push_token);
    }
  });
  console.log(`   ✓ Found ${custTokens.length} customer phone tokens.`);

  // 4. Collect Merchant Tokens
  console.log('4. Collecting Merchant Push Tokens...');
  const merchantTokens = [];
  profSnap.forEach(d => {
    const data = d.data();
    if (data.push_token && data.push_enabled !== false) {
      merchantTokens.push(data.push_token);
    }
  });
  if (supabase) {
    const { data: profiles } = await supabase.from('profiles').select('push_token, push_enabled').eq('role', 'merchant');
    (profiles || []).forEach(p => {
      if (p.push_token && p.push_enabled !== false) merchantTokens.push(p.push_token);
    });
  }
  const uniqueMerchantTokens = Array.from(new Set(merchantTokens));
  console.log(`   ✓ Found ${uniqueMerchantTokens.length} merchant phone tokens.`);

  const allTokens = Array.from(new Set([...custTokens, ...uniqueMerchantTokens]));
  console.log(`\nTotal unique device tokens to deliver: ${allTokens.length}`);

  if (allTokens.length === 0) {
    console.log('No active device tokens found.');
    return;
  }

  // 5. Send FCM Push Notifications
  console.log('\n5. Sending FCM Push Notifications to devices...');
  const messages = allTokens.map(token => ({
    token,
    notification: {
      title: TITLE,
      body: BODY,
    },
    data: {
      url: URL_LINK,
      type: 'announcement',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'ae_notifications',
        sound: 'default',
      },
    },
  }));

  let delivered = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += 500) {
    const batch = messages.slice(i, i + 500);
    const response = await messaging.sendEach(batch);
    delivered += response.successCount;
    failed += response.failureCount;

    response.responses.forEach((r, idx) => {
      if (!r.success) {
        console.warn(`   [Token error] ${r.error?.code || r.error?.message}`);
      }
    });
  }

  // 6. Record in Notification History
  await db.collection('ae_notification_history').add({
    title: TITLE,
    body: BODY,
    url: URL_LINK,
    target: 'all',
    sent_at: FieldValue.serverTimestamp(),
    delivered,
    failed,
    total: allTokens.length,
  });

  console.log('\n========================================================');
  console.log('  BROADCAST SUMMARY');
  console.log('========================================================');
  console.log(`  Total Devices Targeted : ${allTokens.length}`);
  console.log(`  Delivered to Phones    : ${delivered}`);
  console.log(`  Expired / Unregistered : ${failed}`);
  console.log(`  Merchant Inboxes Saved : ${uniqueMerchantIds.length}`);
  console.log('========================================================\n');
}

main().catch(err => {
  console.error('Broadcast failed:', err);
  process.exit(1);
});
