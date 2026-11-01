require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const TARGET_MERCHANT_ID = process.argv.find(a => a.startsWith('--merchant='))?.split('=')[1] || '835d10f1-bb64-43c6-891c-b0152847ace2';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n======================================================`);
  console.log(`  AE Merchant Demo Data Seeder (Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE WRITE'})`);
  console.log(`======================================================`);
  console.log(`Target Merchant ID: ${TARGET_MERCHANT_ID}`);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env');
    process.exit(1);
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Verify target merchant
  const { data: merchant, error: merchErr } = await supabase
    .from('active_merchants')
    .select('id, name, merchant_code, phone, point_balance, network_id')
    .eq('id', TARGET_MERCHANT_ID)
    .single();

  if (merchErr || !merchant) {
    console.error('Merchant not found:', merchErr?.message || 'Invalid ID');
    process.exit(1);
  }

  const networkId = merchant.network_id || '00000000-0000-0000-0000-000000000000';
  console.log(`Found Merchant: "${merchant.name}" (${merchant.merchant_code}) | Phone: ${merchant.phone} | Network: ${networkId}`);
  console.log(`Current Points Balance: ${merchant.point_balance}`);

  // 2. Define Demo Customers
  const demoCustomersData = [
    { code: 'DEMO-C001', name: 'Rahul Sharma', phone: '919000000001', points: 450, scans: 5 },
    { code: 'DEMO-C002', name: 'Anjali Menon', phone: '919000000002', points: 320, scans: 4 },
    { code: 'DEMO-C003', name: 'Mohammed Farhan', phone: '919000000003', points: 680, scans: 3 },
    { code: 'DEMO-C004', name: 'Priya Nair', phone: '919000000004', points: 210, scans: 2 },
    { code: 'DEMO-C005', name: 'Sneha K.', phone: '919000000005', points: 550, scans: 4 },
    { code: 'DEMO-C006', name: 'Vishnu Das', phone: '919000000006', points: 180, scans: 2 },
    { code: 'DEMO-C007', name: 'Kavitha S.', phone: '919000000007', points: 120, scans: 1 },
    { code: 'DEMO-C008', name: 'Arjun Rajesh', phone: '919000000008', points: 95, scans: 1 },
    { code: 'DEMO-C009', name: 'Deepa V.', phone: '919000000009', points: 260, scans: 2 },
    { code: 'DEMO-C010', name: 'Suresh Kumar', phone: '919000000010', points: 150, scans: 1 },
  ];

  console.log(`\nPreparing ${demoCustomersData.length} Demo Customers...`);
  const createdCustomers = [];

  for (const c of demoCustomersData) {
    // Check if customer already exists
    const { data: existing } = await supabase
      .from('customers')
      .select('id, customer_code')
      .eq('customer_code', c.code)
      .maybeSingle();

    let customerId = existing?.id;

    if (!existing && !DRY_RUN) {
      const newId = crypto.randomUUID();
      const { data: inserted, error: insertErr } = await supabase
        .from('customers')
        .insert({
          id: newId,
          customer_code: c.code,
          merchant_id: TARGET_MERCHANT_ID,
          network_id: networkId,
          name: c.name,
          phone: c.phone,
          reward_points: c.points,
          qr_scans: c.scans,
          whatsapp_enabled: false,
          push_enabled: false,
          created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
        })
        .select('id')
        .single();

      if (insertErr) {
        console.warn(`  [Warning] Insert customer ${c.name}:`, insertErr.message);
      } else {
        customerId = inserted.id;
      }
    } else if (existing) {
      customerId = existing.id;
    }

    if (customerId) {
      createdCustomers.push({ ...c, id: customerId });

      // Upsert customer_merchants relation
      if (!DRY_RUN) {
        await supabase
          .from('customer_merchants')
          .upsert({
            customer_id: customerId,
            merchant_id: TARGET_MERCHANT_ID,
            reward_points: c.points,
            qr_scans: c.scans,
            joined_at: new Date(Date.now() - 25 * 86400000).toISOString(),
          }, { onConflict: 'customer_id,merchant_id' });
      }
    } else if (DRY_RUN) {
      createdCustomers.push({ ...c, id: crypto.randomUUID() });
    }
  }

  console.log(`✓ Prepared ${createdCustomers.length} customers.`);

  if (createdCustomers.length === 0) {
    console.error('No customers available to attach orders to.');
    process.exit(1);
  }

  // 3. Generate Realistic Orders
  console.log(`\nGenerating 28 realistic demo orders...`);

  const now = new Date();
  const ordersToInsert = [];

  const rawOrdersConfig = [
    // --- TODAY (Nov 1, 2026) ---
    { custIdx: 0, amount: 350, hoursAgo: 2, isReturning: true },
    { custIdx: 1, amount: 1200, hoursAgo: 5, isReturning: true },
    { custIdx: 2, amount: 850, hoursAgo: 8, isReturning: true },
    { custIdx: 6, amount: 450, hoursAgo: 11, isReturning: false },

    // --- YESTERDAY & THIS WEEK (Late October) ---
    { custIdx: 4, amount: 2400, daysAgo: 1, isReturning: true },
    { custIdx: 5, amount: 650, daysAgo: 1, isReturning: true },
    { custIdx: 3, amount: 1500, daysAgo: 2, isReturning: false },
    { custIdx: 0, amount: 980, daysAgo: 2, isReturning: true },
    { custIdx: 1, amount: 420, daysAgo: 3, isReturning: true },
    { custIdx: 8, amount: 1850, daysAgo: 3, isReturning: false },
    { custIdx: 2, amount: 720, daysAgo: 4, isReturning: true },
    { custIdx: 7, amount: 550, daysAgo: 5, isReturning: false },
    { custIdx: 4, amount: 3100, daysAgo: 5, isReturning: true },
    { custIdx: 9, amount: 600, daysAgo: 6, isReturning: false },

    // --- EARLIER IN OCTOBER ---
    { custIdx: 0, amount: 1100, daysAgo: 8, isReturning: true },
    { custIdx: 1, amount: 850, daysAgo: 9, isReturning: true },
    { custIdx: 5, amount: 1250, daysAgo: 11, isReturning: false },
    { custIdx: 3, amount: 480, daysAgo: 12, isReturning: true },
    { custIdx: 2, amount: 2200, daysAgo: 14, isReturning: false },
    { custIdx: 4, amount: 1750, daysAgo: 15, isReturning: true },
    { custIdx: 8, amount: 950, daysAgo: 17, isReturning: true },
    { custIdx: 0, amount: 1400, daysAgo: 19, isReturning: false },
    { custIdx: 1, amount: 650, daysAgo: 21, isReturning: false },
    { custIdx: 4, amount: 2800, daysAgo: 22, isReturning: false },
    { custIdx: 6, amount: 750, daysAgo: 24, isReturning: false },
    { custIdx: 7, amount: 400, daysAgo: 25, isReturning: false },
    { custIdx: 9, amount: 900, daysAgo: 26, isReturning: false },
    { custIdx: 3, amount: 1650, daysAgo: 28, isReturning: false },
  ];

  let orderCount = 101;
  let totalSales = 0;

  for (const cfg of rawOrdersConfig) {
    const cust = createdCustomers[cfg.custIdx % createdCustomers.length];
    const orderDate = new Date(now.getTime());
    if (cfg.hoursAgo) {
      orderDate.setHours(orderDate.getHours() - cfg.hoursAgo);
    } else if (cfg.daysAgo) {
      orderDate.setDate(orderDate.getDate() - cfg.daysAgo);
      orderDate.setHours(10 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 59));
    }

    const orderNo = `DEMO-ORD-${orderCount++}`;
    // Database enforces: "A purchase may issue between 0 and 100 AE Points only"
    const rewardPoints = Math.min(100, Math.max(5, Math.round((cfg.amount / 100) * 2)));
    totalSales += cfg.amount;

    ordersToInsert.push({
      id: crypto.randomUUID(),
      order_no: orderNo,
      customer_id: cust.id,
      merchant_id: TARGET_MERCHANT_ID,
      amount: cfg.amount,
      location: 'In-store',
      reward_points: rewardPoints,
      reward_percentage: 1,
      is_returning: cfg.isReturning,
      source: 'qr',
      idempotency_key: crypto.randomUUID(),
      whatsapp_sent: false,
      email_sent: false,
      created_at: orderDate.toISOString(),
      network_id: networkId,
    });
  }

  console.log(`Generated ${ordersToInsert.length} demo orders totaling ₹${totalSales.toLocaleString('en-IN')}.`);

  if (!DRY_RUN) {
    // Delete existing DEMO- orders first to avoid duplicates
    await supabase.from('orders').delete().eq('merchant_id', TARGET_MERCHANT_ID).ilike('order_no', 'DEMO-%');

    // Batch insert orders
    const { error: ordErr } = await supabase.from('orders').insert(ordersToInsert);
    if (ordErr) {
      console.error('Failed to insert orders:', ordErr.message);
    } else {
      console.log(`✓ Inserted ${ordersToInsert.length} orders successfully.`);
    }

    // 4. Update Merchant Points Balance to 5000
    const { error: ptErr } = await supabase
      .from('active_merchants')
      .update({ point_balance: 5000 })
      .eq('id', TARGET_MERCHANT_ID);

    if (ptErr) {
      console.warn('Could not update point balance:', ptErr.message);
    } else {
      console.log(`✓ Updated Merchant Point Balance to 5,000 AE Points.`);
    }

    // 5. Insert Sample WhatsApp Grocery List Request
    const demoGroceryCust = createdCustomers[0];
    await supabase.from('customer_product_list_requests').delete().eq('merchant_id', TARGET_MERCHANT_ID).eq('customer_id', demoGroceryCust.id);

    const { error: reqErr } = await supabase
      .from('customer_product_list_requests')
      .insert({
        customer_id: demoGroceryCust.id,
        merchant_id: TARGET_MERCHANT_ID,
        product_list: "1. Premium Basmati Rice 5kg\n2. Sunflower Cooking Oil 1L\n3. Pure Sugar 2kg\n4. Premium Tea Powder 500g\n5. Wheat Flour (Atta) 5kg",
        status: 'approved',
        merchant_status: null,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      });

    if (reqErr) {
      console.warn('Could not insert sample product list:', reqErr.message);
    } else {
      console.log(`✓ Inserted sample WhatsApp grocery order for merchant inbox.`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`  Demo Data Setup Complete!`);
  console.log(`  Merchant Name: ${merchant.name}`);
  console.log(`  Total Demo Orders: ${ordersToInsert.length}`);
  console.log(`  Total Demo Volume: ₹${totalSales.toLocaleString('en-IN')}`);
  console.log(`  Available Points: 5,000`);
  console.log(`======================================================\n`);
}

main().catch(err => {
  console.error('Fatal error in demo seeder:', err);
  process.exit(1);
});
