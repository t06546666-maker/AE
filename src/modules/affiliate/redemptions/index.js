const express = require('express');
const crypto = require('crypto');
const { supabase } = require('../common/db');
const { toPaise } = require('../common/money');
const { logAudit } = require('../audit');
const { getCustomerEntitlement } = require('../rewards');
const { MockPaymentProvider } = require('../payments/MockPaymentProvider');

const router = express.Router();
const paymentProvider = new MockPaymentProvider();

/**
 * Perform FIFO allocation of reward lots for a redemption amount.
 * Note: Uses sequential Supabase calls. In a highly concurrent prod environment,
 * this should ideally use a Postgres stored procedure with row-level locks.
 */
async function allocateFIFO(redemptionId, customerId, networkId, amountToConsumePaise) {
  let remainingToConsume = amountToConsumePaise;

  // Fetch available lots ordered by oldest first
  const { data: lots, error } = await supabase
    .from('reward_lots')
    .select('*')
    .eq('customer_id', customerId)
    .eq('network_id', networkId)
    .eq('status', 'AVAILABLE')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch lots: ${error.message}`);

  const allocations = [];

  for (const lot of lots) {
    if (remainingToConsume <= 0) break;

    const available = parseInt(lot.available_amount_paise, 10);
    const consumeAmount = Math.min(available, remainingToConsume);

    // 1. Create Allocation Record
    await supabase.from('redemption_allocations').insert({
      redemption_id: redemptionId,
      reward_lot_id: lot.id,
      funding_merchant_id: lot.funding_merchant_id,
      amount_consumed_paise: consumeAmount
    });

    // 2. Update Lot Balance
    const newBalance = available - consumeAmount;
    const newStatus = newBalance === 0 ? 'EXHAUSTED' : 'AVAILABLE';
    
    await supabase.from('reward_lots')
      .update({ available_amount_paise: newBalance, status: newStatus })
      .eq('id', lot.id);

    allocations.push({ lot_id: lot.id, consumed: consumeAmount });
    remainingToConsume -= consumeAmount;
  }

  if (remainingToConsume > 0) {
    throw new Error('Critical Error: Insufficient funds during FIFO allocation. State corrupted.');
  }

  return allocations;
}

router.post('/', async (req, res) => {
  const { customerId, type, amountPaise, networkId } = req.body;
  if (!customerId || !amountPaise) return res.status(400).json({ error: 'Missing parameters' });

  const netId = networkId || '00000000-0000-0000-0000-000000000000';

  try {
    // 1. Verify Minimum Entitlement (₹100 = 10000 paise)
    const entitlement = await getCustomerEntitlement(netId, customerId);
    if (entitlement < 10000) {
      return res.status(400).json({ error: 'Minimum redemption threshold is ₹100' });
    }
    if (entitlement < amountPaise) {
      return res.status(400).json({ error: 'Insufficient reward entitlement' });
    }

    const idempotencyKey = `REDEMPTION_${crypto.randomBytes(8).toString('hex')}`;

    // 2. Create Redemption Request
    const { data: redemption, error: redError } = await supabase.from('redemptions').insert({
      network_id: netId,
      customer_id: customerId,
      type: type || 'UPI_PAYOUT',
      amount_paise: amountPaise,
      status: 'PROCESSING',
      idempotency_key: idempotencyKey
    }).select().single();

    if (redError) throw new Error(redError.message);

    // 3. FIFO Allocation
    await allocateFIFO(redemption.id, customerId, netId, amountPaise);

    // 4. Ledger Event
    await supabase.from('reward_ledger').insert({
      network_id: netId,
      customer_id: customerId,
      amount_paise: amountPaise,
      event_type: 'REWARD_REDEEMED',
      idempotency_key: `LEDGER_${idempotencyKey}`
    });

    // 5. Trigger Payment Provider if UPI_PAYOUT
    if (redemption.type === 'UPI_PAYOUT') {
      const paymentInst = {
        id: crypto.randomUUID(), // Mock instruction ID
        amount_paise: amountPaise
      };
      
      // Save instruction
      await supabase.from('payment_instructions').insert({
        id: paymentInst.id,
        network_id: netId,
        redemption_id: redemption.id,
        recipient_type: 'CUSTOMER',
        recipient_id: customerId,
        amount_paise: amountPaise,
        idempotency_key: `PAY_INST_${redemption.id}`
      });

      await paymentProvider.createCustomerPayout(paymentInst);
    }

    await logAudit(netId, 'REDEMPTION', redemption.id, 'REQUESTED', 'CUSTOMER', { amount: amountPaise });

    res.json({ success: true, redemption });

  } catch (err) {
    console.error('Redemption error', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('redemptions').select('*').eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ error: 'Redemption not found' });
  res.json(data);
});

module.exports = router;
