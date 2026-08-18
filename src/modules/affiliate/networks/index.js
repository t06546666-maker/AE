const express = require('express');
const { supabase } = require('../common/db');
const { logAudit } = require('../audit');
const router = express.Router();

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

module.exports = router;
