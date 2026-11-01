require('dotenv').config();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

// Parse CLI args:
// node scripts/broadcast-customer-notification.cjs --title="Your title" --body="Your message" --url="https://..." [--dry-run]
const args = process.argv.slice(2);
function getArg(prefix, fallback = '') {
  const match = args.find(a => a.startsWith(prefix));
  return match ? match.slice(prefix.length).replace(/^["']|["']$/g, '') : fallback;
}

const DRY_RUN = args.includes('--dry-run');
const TITLE = getArg('--title=', 'How to use AE 🚀');
const BODY = getArg('--body=', 'Tap to watch how to earn points, claim rewards, and order on WhatsApp!');
const URL_LINK = getArg('--url=', '');

async function main() {
  console.log('\n======================================================');
  console.log(`  AE Customer Broadcast Notification Tool (Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE BROADCAST'})`);
  console.log('======================================================');
  console.log(`Title : ${TITLE}`);
  console.log(`Body  : ${BODY}`);
  console.log(`Link  : ${URL_LINK || '(No link provided)'}`);

  // Initialize Firebase Admin
  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('firebase-service-account.json not found!');
    process.exit(1);
  }

  const serviceAccount = require(serviceAccountPath);
  let app = getApps().length > 0 ? getApps()[0] : null;
  if (!app) {
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  }

  const db = getFirestore(app);
  const messaging = getMessaging(app);

  // 1. Save Announcement in Firestore for in-app Notifications tab
  if (!DRY_RUN) {
    console.log('\n1. Saving announcement in customer in-app notifications...');
    const docRef = await db.collection('ae_customer_announcements').add({
      title: TITLE,
      body: BODY,
      url: URL_LINK,
      created_at: FieldValue.serverTimestamp(),
    });
    console.log(`✓ Saved announcement to in-app inbox (ID: ${docRef.id}).`);
  } else {
    console.log('\n1. [DRY-RUN] Would save announcement to in-app inbox.');
  }

  // 2. Query all customer devices with push tokens
  console.log('\n2. Querying registered customer push tokens from Firestore...');
  const snapshot = await db.collection('ae_customer_notifications').get();
  const targets = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.push_token && data.push_enabled !== false) {
      targets.push({
        customerId: doc.id,
        token: data.push_token,
      });
    }
  });

  console.log(`Found ${targets.length} registered customer devices eligible for push notifications.`);

  if (targets.length === 0) {
    console.log('No registered customer tokens found.');
    return;
  }

  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] Would broadcast notification to ${targets.length} customer devices.`);
    console.log('Finished dry run without sending.');
    return;
  }

  // 3. Send FCM push notifications in batches
  console.log(`\n3. Broadcasting push notifications to ${targets.length} devices...`);

  const messages = targets.map(t => ({
    token: t.token,
    notification: {
      title: TITLE,
      body: BODY,
    },
    data: {
      url: URL_LINK || '/customer/notifications',
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

  // Batch in chunks of 500 (Firebase Admin maximum)
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < messages.length; i += 500) {
    const chunk = messages.slice(i, i + 500);
    const response = await messaging.sendEach(chunk);
    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((r, idx) => {
      if (!r.success) {
        console.warn(`  [Notice] Token ${targets[i + idx].customerId} error:`, r.error?.message);
      }
    });
  }

  console.log('\n======================================================');
  console.log(`  Broadcast Complete!`);
  console.log(`  Delivered Successfully : ${successCount}`);
  console.log(`  Failed / Expired Tokens: ${failureCount}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Fatal error in broadcast tool:', err);
  process.exit(1);
});

