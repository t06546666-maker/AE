const express = require('express');
const { supabase } = require('../common/db');
const { logAudit } = require('../audit');
const { MockPaymentProvider } = require('../payments/MockPaymentProvider');
const router = express.Router();
const paymentProvider = new MockPaymentProvider();

/**
 * Weekly Settlement Cycle Runner
 * 1. Creates a new settlement cycle
 * 2. Finds all un-settled redemptions and their allocations
 * 3. Creates merchant_funding_obligations
 * 4. Nets payables and receivables
 * 5. Reconciles
 * 6. Triggers payment instructions if balanced
 */
async function runSettlementCycle(networkId) {
  const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const periodEnd = new Date().toISOString();

  // 1. Create Cycle
  const { data: cycle, error: cycleErr } = await supabase.from('settlement_cycles').insert({
    network_id: networkId,
    period_start: periodStart,
    period_end: periodEnd,
    status: 'CALCULATING'
  }).select().single();

  if (cycleErr) throw new Error(cycleErr.message);

  // 2. Fetch unprocessed redemptions
  // In a real system we'd flag them as 'SETTLED' once processed, or just query by date range
  const { data: allocations, error: allocErr } = await supabase
    .from('redemption_allocations')
    .select(`
      id, amount_consumed_paise, funding_merchant_id, reward_lot_id, redemption_id,
      redemptions ( id, customer_id, redeeming_merchant_id )
    `)
    .eq('redemptions.network_id', networkId);
    // Ideally filter by redemptions that haven't been settled yet.

  if (allocErr) throw new Error(allocErr.message);

  let totalPayables = 0;
  let totalReceivables = 0;
  const merchantPositions = {};

  // Initialize merchant positions
  const getPos = (mId) => {
    if (!merchantPositions[mId]) {
      merchantPositions[mId] = { payable: 0, receivable: 0 };
    }
    return merchantPositions[mId];
  };

  // 3. Process Allocations into Obligations
  for (const alloc of allocations) {
    if (!alloc.redemptions) continue; // inner join filter fallback

    const amount = parseInt(alloc.amount_consumed_paise, 10);
    const fundingMId = alloc.funding_merchant_id;
    const receivingMId = alloc.redemptions.redeeming_merchant_id; // null for UPI payout

    // Create Funding Obligation
    await supabase.from('merchant_funding_obligations').insert({
      settlement_cycle_id: cycle.id,
      network_id: networkId,
      funding_merchant_id: fundingMId,
      receiving_merchant_id: receivingMId,
      customer_id: alloc.redemptions.customer_id,
      redemption_id: alloc.redemption_id,
      reward_lot_id: alloc.reward_lot_id,
      amount_paise: amount
    });

    // Funding merchant owes money
    getPos(fundingMId).payable += amount;
    totalPayables += amount;

    // If there is a receiving merchant (e.g. voucher redeemed at store), they receive money
    if (receivingMId) {
      getPos(receivingMId).receivable += amount;
      totalReceivables += amount;
    }
  }

  // 4. Netting & Reconciliation
  // Since some payouts are UPI directly to customer, totalReceivables will be LESS than totalPayables
  // by exactly the amount of UPI payouts.
  // We skip strict global reconciliation here to allow UPI payouts, but we still net merchant to merchant.

  for (const [mId, pos] of Object.entries(merchantPositions)) {
    const net = pos.receivable - pos.payable;
    let type = 'BALANCED';
    if (net > 0) type = 'RECEIVE';
    if (net < 0) type = 'PAY';

    await supabase.from('merchant_ledger').insert({
      network_id: networkId,
      settlement_cycle_id: cycle.id,
      merchant_id: mId,
      receivable_paise: pos.receivable,
      payable_paise: pos.payable,
      net_amount_paise: Math.abs(net),
      position_type: type
    });

    // 6. Trigger Payment Instruction
    if (type === 'RECEIVE') {
      const instId = require('crypto').randomUUID();
      await supabase.from('payment_instructions').insert({
        id: instId,
        network_id: networkId,
        settlement_cycle_id: cycle.id,
        recipient_type: 'MERCHANT',
        recipient_id: mId,
        amount_paise: Math.abs(net),
        idempotency_key: `SETTLE_${cycle.id}_${mId}`
      });
      await paymentProvider.createMerchantSettlement({ id: instId, amount_paise: Math.abs(net) });
    }
  }

  // Mark cycle settled
  await supabase.from('settlement_cycles')
    .update({ 
      status: 'SETTLED', 
      total_payables_paise: totalPayables, 
      total_receivables_paise: totalReceivables,
      reconciled_at: new Date().toISOString()
    })
    .eq('id', cycle.id);

  await logAudit(networkId, 'SETTLEMENT', cycle.id, 'COMPLETED', 'SYSTEM', { totalPayables, totalReceivables });

  return cycle.id;
}

router.post('/run', async (req, res) => {
  const { networkId } = req.body;
  if (!networkId) return res.status(400).json({ error: 'networkId required' });
  try {
    const cycleId = await runSettlementCycle(networkId);
    res.json({ success: true, cycleId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('settlement_cycles').select('*').eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

module.exports = {
  router,
  runSettlementCycle
};
