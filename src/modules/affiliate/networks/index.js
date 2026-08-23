const express = require('express');
const { supabase } = require('../common/db');
const { logAudit } = require('../audit');
const router = express.Router();

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('networks').select('id, code, name, created_at').order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, networks: data });
});

router.post('/', async (req, res) => {
  const { code, name, currency, rewardRateBps, minRedemptionThresholdPaise } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Code and Name are required' });

  const { data, error } = await supabase.from('networks').insert({
    code,
    name,
    currency: currency || 'INR',
    reward_rate_bps: rewardRateBps || 100,
    min_redemption_threshold_paise: minRedemptionThresholdPaise || 10000
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });

  await logAudit(data.id, 'NETWORK', data.id, 'CREATED', req.auth?.user?.id);
  res.status(201).json(data);
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('networks').select('*').eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ error: 'Network not found' });
  res.json(data);
});

router.post('/:id/merchants', async (req, res) => {
  const { merchantId } = req.body;
  if (!merchantId) return res.status(400).json({ error: 'merchantId is required' });

  // In Affiliate AE, merchants just belong to a network via network_id
  const { data, error } = await supabase.from('merchants')
    .update({ network_id: req.params.id })
    .eq('id', merchantId)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  await logAudit(req.params.id, 'MERCHANT_NETWORK', merchantId, 'ASSIGNED', req.auth?.user?.id, { network_id: req.params.id });
  res.json({ success: true, merchant: data });
});

router.delete('/:id', async (req, res) => {
  const networkId = req.params.id;

  // Find all nested entities to clean up their dependents
  const { data: merchants } = await supabase.from('merchants').select('id').eq('network_id', networkId);
  const merchantIds = (merchants || []).map(m => m.id);

  if (merchantIds.length > 0) {
    // Get all child records by merchant_id to avoid relying on network_id migration state
    const [{ data: customers }, { data: orders }] = await Promise.all([
      supabase.from('customers').select('id').in('merchant_id', merchantIds),
      supabase.from('orders').select('id').in('merchant_id', merchantIds)
    ]);
    
    const customerIds = (customers || []).map(c => c.id);
    const orderIds = (orders || []).map(o => o.id);

    const { data: profiles } = await supabase.from('profiles').select('id').in('merchant_id', merchantIds);
    for (const profile of profiles || []) {
      if (supabase.auth?.admin) await supabase.auth.admin.deleteUser(profile.id).catch(() => {});
    }
    await supabase.from('profiles').delete().in('merchant_id', merchantIds);
    await supabase.from('customer_merchants').delete().in('merchant_id', merchantIds);
    
    // Cleanup voucher/redemption pivot tables
    await supabase.from('voucher_redemptions').delete().in('redeeming_merchant_id', merchantIds);
    await supabase.from('redemption_allocations').delete().in('funding_merchant_id', merchantIds);

    if (customerIds.length > 0) {
      await supabase.from('customer_merchants').delete().in('customer_id', customerIds);
      await supabase.from('whatsapp_messages').delete().in('customer_id', customerIds);
    }

    if (orderIds.length > 0) {
      await supabase.from('whatsapp_messages').delete().in('order_id', orderIds);
    }

    if (orderIds.length > 0) await supabase.from('orders').delete().in('merchant_id', merchantIds);
    if (customerIds.length > 0) await supabase.from('customers').delete().in('merchant_id', merchantIds);
    await supabase.from('merchants').delete().in('id', merchantIds);
  }

  // Cascade delete all network-level entities
  await Promise.all([
    supabase.from('vouchers').delete().eq('network_id', networkId),
    supabase.from('redemptions').delete().eq('network_id', networkId),
    supabase.from('reward_ledger').delete().eq('network_id', networkId),
    supabase.from('reward_lots').delete().eq('network_id', networkId),
    supabase.from('reward_rules').delete().eq('network_id', networkId),
  ]);

  // Finally delete the network
  const { error } = await supabase.from('networks').delete().eq('id', networkId);
  if (error) return res.status(500).json({ error: error.message });

  await logAudit(req.params.id, 'NETWORK', req.params.id, 'DELETED', req.auth?.user?.id);
  res.json({ success: true });
});

module.exports = router;
