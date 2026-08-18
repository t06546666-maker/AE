const express = require('express');
const { supabase } = require('../common/db');
const { toPaise } = require('../common/money');
const { logAudit } = require('../audit');
const crypto = require('crypto');
const router = express.Router();

/**
 * Core Business Logic: Record an earned reward immutably
 * and create a FIFO reward lot preserving the funding merchant.
 */
async function recordRewardEarned(transaction, rewardAmountPaise) {
  if (!supabase) return;

  const idempotencyKey = `REWARD_EARN_${transaction.id}`;
  
  // 1. Write Immutable Event to Ledger
  const { data: ledgerEntry, error: ledgerError } = await supabase.from('reward_ledger').insert({
    network_id: transaction.network_id,
    customer_id: transaction.customer_id,
    merchant_id: transaction.merchant_id,
    transaction_id: transaction.id,
    amount_paise: rewardAmountPaise,
    event_type: 'REWARD_EARNED',
    idempotency_key: idempotencyKey,
    metadata: { order_no: transaction.order_no }
  }).select().single();

  // If duplicate idempotency key, we skip (it was already processed)
  if (ledgerError && ledgerError.code === '23505') {
    return { success: true, skipped: true };
  }
  if (ledgerError) throw new Error(`Ledger Error: ${ledgerError.message}`);

  // 2. Create Reward Lot
  const { error: lotError } = await supabase.from('reward_lots').insert({
    network_id: transaction.network_id,
    customer_id: transaction.customer_id,
    funding_merchant_id: transaction.merchant_id,
    transaction_id: transaction.id,
    initial_amount_paise: rewardAmountPaise,
    available_amount_paise: rewardAmountPaise,
    status: 'AVAILABLE'
  });

  if (lotError) throw new Error(`Lot Error: ${lotError.message}`);

  await logAudit(
    transaction.network_id, 
    'CUSTOMER_REWARD', 
    transaction.customer_id, 
    'EARNED', 
    'SYSTEM', 
    { amount: rewardAmountPaise, tx_id: transaction.id }
  );

  return { success: true, ledgerId: ledgerEntry.id };
}

/**
 * Retrieves the aggregate reward balance for a customer across a network
 */
async function getCustomerEntitlement(networkId, customerId) {
  // Sum of all 'AVAILABLE' lots
  const { data, error } = await supabase
    .from('reward_lots')
    .select('available_amount_paise')
    .eq('network_id', networkId)
    .eq('customer_id', customerId)
    .eq('status', 'AVAILABLE');
    
  if (error) throw error;
  
  const total = data.reduce((sum, row) => sum + parseInt(row.available_amount_paise, 10), 0);
  return total;
}

// API Routes
router.get('/customers/:id/reward-lots', async (req, res) => {
  const { data, error } = await supabase
    .from('reward_lots')
    .select('*')
    .eq('customer_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/customers/:id/rewards', async (req, res) => {
  // Aggregate sum
  const networkId = req.query.network_id || '00000000-0000-0000-0000-000000000000';
  try {
    const total = await getCustomerEntitlement(networkId, req.params.id);
    res.json({ customer_id: req.params.id, network_id: networkId, available_paise: total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = {
  router,
  recordRewardEarned,
  getCustomerEntitlement
};
