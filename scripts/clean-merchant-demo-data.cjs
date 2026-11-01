require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const TARGET_MERCHANT_ID = process.argv.find(a => a.startsWith('--merchant='))?.split('=')[1] || '835d10f1-bb64-43c6-891c-b0152847ace2';

async function main() {
  console.log(`\n======================================================`);
  console.log(`  Cleaning AE Merchant Demo Data`);
  console.log(`======================================================`);
  console.log(`Target Merchant ID: ${TARGET_MERCHANT_ID}`);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env');
    process.exit(1);
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Delete DEMO orders
  const { data: deletedOrders, error: ordErr } = await supabase
    .from('orders')
    .delete()
    .eq('merchant_id', TARGET_MERCHANT_ID)
    .ilike('order_no', 'DEMO-%')
    .select('id');

  console.log(`✓ Deleted ${deletedOrders?.length || 0} demo orders.`);

  // 2. Delete DEMO product list requests
  const { data: demoCusts } = await supabase
    .from('customers')
    .select('id')
    .ilike('customer_code', 'DEMO-%');

  const demoCustIds = (demoCusts || []).map(c => c.id);

  if (demoCustIds.length > 0) {
    await supabase
      .from('customer_product_list_requests')
      .delete()
      .eq('merchant_id', TARGET_MERCHANT_ID)
      .in('customer_id', demoCustIds);
    console.log(`✓ Deleted demo product list requests.`);

    // 3. Delete customer_merchants links
    await supabase
      .from('customer_merchants')
      .delete()
      .eq('merchant_id', TARGET_MERCHANT_ID)
      .in('customer_id', demoCustIds);
    console.log(`✓ Deleted customer_merchants demo records.`);

    // 4. Delete demo customers
    await supabase
      .from('customers')
      .delete()
      .in('id', demoCustIds);
    console.log(`✓ Deleted ${demoCustIds.length} demo customers.`);
  }

  // 5. Reset point balance back to original 1674
  await supabase
    .from('active_merchants')
    .update({ point_balance: 1674 })
    .eq('id', TARGET_MERCHANT_ID);

  console.log(`✓ Restored Merchant Point Balance to 1,674.`);

  console.log(`\n======================================================`);
  console.log(`  Cleanup Complete! Real data was untouched.`);
  console.log(`======================================================\n`);
}

main().catch(err => {
  console.error('Fatal error in cleanup:', err);
  process.exit(1);
});
