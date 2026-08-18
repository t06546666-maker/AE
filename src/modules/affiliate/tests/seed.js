const { supabase } = require('../common/db');
const { toPaise } = require('../common/money');

async function runSeed() {
  console.log('Seeding PALAKKAD-001 Network...');
  
  // 1. Create Network
  const { data: network, error: netErr } = await supabase.from('networks').upsert({
    code: 'PALAKKAD-001',
    name: 'Palakkad Merchants Association',
    currency: 'INR',
    reward_rate_bps: 100, // 1%
    min_redemption_threshold_paise: 10000 // ₹100
  }, { onConflict: 'code' }).select().single();

  if (netErr) throw new Error(`Network Seed Failed: ${netErr.message}`);

  // 2. Create Merchants A-E
  const merchants = [
    { merchant_code: 'MER_A', name: 'Merchant A', email: 'a@example.com', phone: '919000000001', network_id: network.id },
    { merchant_code: 'MER_B', name: 'Merchant B', email: 'b@example.com', phone: '919000000002', network_id: network.id },
    { merchant_code: 'MER_C', name: 'Merchant C', email: 'c@example.com', phone: '919000000003', network_id: network.id },
    { merchant_code: 'MER_D', name: 'Merchant D', email: 'd@example.com', phone: '919000000004', network_id: network.id },
    { merchant_code: 'MER_E', name: 'Merchant E', email: 'e@example.com', phone: '919000000005', network_id: network.id }
  ];

  const merchantIds = {};
  for (const m of merchants) {
    const { data: created, error } = await supabase.from('merchants').upsert(m, { onConflict: 'merchant_code' }).select().single();
    if (error) console.log(`Skipping existing merchant ${m.name}`);
    merchantIds[m.name] = created?.id;
  }

  // 3. Create Customer C001
  const { data: customer, error: custErr } = await supabase.from('customers').upsert({
    customer_code: 'C001',
    name: 'Test Customer',
    phone: '919999999999',
    merchant_id: merchantIds['Merchant A'] || Object.values(merchantIds)[0],
    network_id: network.id
  }, { onConflict: 'customer_code' }).select().single();

  if (custErr) console.log('Skipping existing customer C001');

  console.log('Seed Complete!');
}

runSeed().catch(console.error);
