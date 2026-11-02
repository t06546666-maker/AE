require('dotenv').config();
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const serviceAccount = require(path.join(__dirname, '../firebase-service-account.json'));
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore(app);

  // 1. Get active merchants
  const { data: merchants, error } = await supabase
    .from('active_merchants')
    .select('id, merchant_code, name, phone, email, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching merchants:', error.message);
    process.exit(1);
  }

  // 2. Get profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, merchant_id, email, role, push_token, push_enabled')
    .eq('role', 'merchant');

  // 3. Get Firestore registrations
  const pSnap = await db.collection('ae_profile_push_registrations').get();
  const fireByProfileId = new Map();
  const fireByMerchantId = new Map();
  pSnap.forEach(doc => {
    const d = doc.data();
    if (d.push_token && d.push_enabled !== false) {
      fireByProfileId.set(doc.id, d);
      if (d.merchant_id) fireByMerchantId.set(d.merchant_id, d);
    }
  });

  const profileByMerchantId = new Map();
  (profiles || []).forEach(p => {
    if (p.merchant_id) profileByMerchantId.set(p.merchant_id, p);
  });

  console.log(`\n=== REAL-TIME MERCHANT NOTIFICATION STATUS (${merchants.length} Active Stores) ===\n`);

  const active = [];
  const pending = [];

  for (const m of merchants) {
    const prof = profileByMerchantId.get(m.id);
    const fire = fireByMerchantId.get(m.id) || (prof ? fireByProfileId.get(prof.id) : null);
    const hasPush = Boolean((prof?.push_token && prof.push_enabled !== false) || fire);

    const info = {
      code: m.merchant_code,
      name: m.name,
      phone: m.phone,
      email: m.email,
      registeredAt: fire?.updated_at || 'N/A',
      tokenPrefix: fire?.push_token ? fire.push_token.substring(0, 14) + '...' : (prof?.push_token ? prof.push_token.substring(0, 14) + '...' : 'none'),
    };

    if (hasPush) {
      active.push(info);
    } else {
      pending.push(info);
    }
  }

  console.log(`🟢 ACTIVE MERCHANTS (${active.length}):`);
  active.forEach((m, i) => {
    console.log(`  ${i+1}. [${m.code}] ${m.name} | Phone: ${m.phone} | Updated: ${m.registeredAt} | Token: ${m.tokenPrefix}`);
  });

  console.log(`\n⚪ PENDING MERCHANTS (${pending.length}):`);
  pending.forEach((m, i) => {
    console.log(`  ${i+1}. [${m.code}] ${m.name} | Phone: ${m.phone} | Email: ${m.email}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

