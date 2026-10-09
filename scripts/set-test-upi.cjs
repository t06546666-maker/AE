// Explicitly scoped configuration for the user-designated test merchant only.
require('dotenv').config({ quiet: true });
const { createClient } = require('@supabase/supabase-js');
(async () => {
  // The saved URL has a typo; use the project reference carried by its service key.
  const keyProject = JSON.parse(Buffer.from(process.env.SUPABASE_SERVICE_ROLE_KEY.split('.')[1], 'base64url').toString()).ref;
  if (keyProject !== 'zrsjgbgzkaxccetjahcy') throw new Error('Unexpected database project. Nothing changed.');
  const db = createClient(`https://${keyProject}.supabase.co`, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  let targetUser = null;
  for (let page=1; page<=20; page++) {
    const response = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (response.error) throw response.error;
    targetUser = response.data.users.find(user => user.email?.toLowerCase() === 'safar1@gmail.com');
    if (targetUser || response.data.users.length<200) break;
  }
  if (!targetUser) throw new Error('Test sign-in account not found. Nothing changed.');
  const { data: profiles, error } = await db.from('profiles').select('id,role,merchant_id,full_name').eq('id',targetUser.id);
  if (error) throw error;
  if (profiles?.length !== 1 || profiles[0].role !== 'merchant' || !profiles[0].merchant_id) throw new Error('Expected exactly one merchant profile for safar1@gmail.com. Nothing changed.');
  const profile = profiles[0];
  const merchant = await db.from('merchants').select('id,name,email').eq('id',profile.merchant_id).single();
  if (merchant.error) throw merchant.error;
  const fs = require('node:fs');
  const path = require('node:path');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const servicePath = path.join(process.cwd(),'firebase-service-account.json');
  const serviceAccount = fs.existsSync(servicePath) ? JSON.parse(fs.readFileSync(servicePath,'utf8')) : JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 'null');
  if (!serviceAccount) throw new Error('Firebase settings unavailable. Nothing changed.');
  initializeApp({ credential: cert(serviceAccount) });
  const ref = getFirestore().collection('ae_merchant_payment_settings').doc(profile.merchant_id);
  const existing = await ref.get();
  const settings = existing.exists ? existing.data() : {};
  console.log(JSON.stringify({ account: targetUser.email, merchantId: profile.merchant_id, shop: merchant.data.name, configuredUpi: settings.upiId || null }));
  if (!process.argv.includes('--apply')) return;
  const value = { ...settings, upiId: 'mohammedsafar845@oksbi', displayName: merchant.data.name, pilotUpiEnabled: true };
  await ref.set(value);
  console.log('Saved test merchant UPI settings. Payment status and other merchant settings unchanged.');
})().catch(error=>{ console.error(error.message); process.exitCode=1; });
