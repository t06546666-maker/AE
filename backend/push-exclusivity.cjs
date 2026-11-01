/**
 * Ensures that a physical device FCM push token is only bound to ONE active role and account at any time.
 * If a device logs in as a Customer, it is automatically detached from any previous Merchant / Staff / Profile.
 * If a device logs in as a Merchant, it is automatically detached from any previous Customer accounts.
 */
async function enforcePushTokenExclusivity({
  token,
  role, // 'customer' | 'profile'
  entityId, // customerId or profileId
  supabaseAdmin,
  getFirestore,
}) {
  if (!token || typeof token !== 'string' || !token.trim()) return;
  const cleanToken = token.trim();

  try {
    const db = await getFirestore();

    if (role === 'customer') {
      // 1. Clear this token from all profiles in Supabase
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('profiles')
          .update({ push_token: null })
          .eq('push_token', cleanToken);
      }

      // 2. Clear this token from ae_profile_push_registrations in Firestore
      const profileSnap = await db
        .collection('ae_profile_push_registrations')
        .where('push_token', '==', cleanToken)
        .get();

      if (!profileSnap.empty) {
        const batch = db.batch();
        profileSnap.forEach((doc) => {
          batch.update(doc.ref, { push_token: null, push_enabled: false });
        });
        await batch.commit();
        console.log(`[push-exclusivity] Cleared token from ${profileSnap.size} merchant/profile accounts because device is now active as Customer (${entityId})`);
      }

      // 3. Clear this token from any other customer accounts in ae_customer_notifications
      const otherCustSnap = await db
        .collection('ae_customer_notifications')
        .where('push_token', '==', cleanToken)
        .get();

      if (!otherCustSnap.empty) {
        const batch = db.batch();
        otherCustSnap.forEach((doc) => {
          if (doc.id !== String(entityId)) {
            batch.update(doc.ref, { push_token: null, push_enabled: false });
          }
        });
        await batch.commit();
      }
    } else {
      // Role is merchant / field manager / staff / admin (profile)
      // 1. Clear this token from all customer accounts in ae_customer_notifications
      const custSnap = await db
        .collection('ae_customer_notifications')
        .where('push_token', '==', cleanToken)
        .get();

      if (!custSnap.empty) {
        const batch = db.batch();
        custSnap.forEach((doc) => {
          batch.update(doc.ref, { push_token: null, push_enabled: false });
        });
        await batch.commit();
        console.log(`[push-exclusivity] Cleared token from ${custSnap.size} customer accounts because device is now active as Merchant/Profile (${entityId})`);
      }

      // 2. Clear this token from other profiles in ae_profile_push_registrations
      const otherProfilesSnap = await db
        .collection('ae_profile_push_registrations')
        .where('push_token', '==', cleanToken)
        .get();

      if (!otherProfilesSnap.empty) {
        const batch = db.batch();
        otherProfilesSnap.forEach((doc) => {
          if (doc.id !== String(entityId)) {
            batch.update(doc.ref, { push_token: null, push_enabled: false });
          }
        });
        await batch.commit();
      }

      // 3. Clear this token from any other profiles in Supabase
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('profiles')
          .update({ push_token: null })
          .eq('push_token', cleanToken)
          .neq('id', entityId);
      }
    }
  } catch (err) {
    console.warn('[push-exclusivity] Warning during exclusivity check:', err.message);
  }
}

module.exports = {
  enforcePushTokenExclusivity,
};
