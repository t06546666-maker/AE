import { randomUUID } from 'crypto';
import {
  MerchantLedgerPosition,
  PaymentInstruction,
  SettlementBatch,
  SettlementCycle,
  SettlementLine
} from '../../common/types';
import { db } from '../../database/db';
import { Money } from '../../common/money';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { NetworksService } from '../networks/networks.service';
import { MerchantsService } from '../merchants/merchants.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { razorpayPaymentProvider } from '../payments/razorpay-payment-provider';

export class SettlementsService {
  static async runSettlementCycle(data: {
    network_id: string;
    period_start?: string;
    period_end?: string;
  }): Promise<{
    cycle: SettlementCycle;
    positions: MerchantLedgerPosition[];
    settlement_lines: SettlementLine[];
    batch?: SettlementBatch;
    payment_instructions?: PaymentInstruction[];
  }> {
    if (!data.network_id) {
      throw new ValidationError('network_id is required.');
    }

    const network = NetworksService.getNetwork(data.network_id);

    const now = new Date();
    const periodEnd = data.period_end || now.toISOString();
    const periodStart = data.period_start || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const cycleId = randomUUID();
    const cycle: SettlementCycle = {
      id: cycleId,
      network_id: network.id,
      period_start: periodStart,
      period_end: periodEnd,
      status: 'FROZEN', // 1. Freeze period
      total_payables_paise: 0,
      total_receivables_paise: 0,
      created_at: now.toISOString()
    };

    db.settlementCycles.set(cycle.id, cycle);
    cycle.status = 'CALCULATING';

    // Track receivables and payables per merchant
    const merchantReceivables = new Map<string, number>();
    const merchantPayables = new Map<string, number>();

    const networkMerchants = MerchantsService.listMerchants(network.id);
    for (const m of networkMerchants) {
      merchantReceivables.set(m.id, 0);
      merchantPayables.set(m.id, 0);
    }

    // Process Redemptions & Lot Allocations in Network
    const redemptionAllocationsList = Array.from(db.redemptionAllocations.values());
    const redemptionsList = Array.from(db.redemptions.values()).filter(r => r.network_id === network.id && r.status === 'COMPLETED');

    for (const redemption of redemptionsList) {
      const allocations = redemptionAllocationsList.filter(a => a.redemption_id === redemption.id);

      if (redemption.type === 'NETWORK_VOUCHER' && redemption.redeeming_merchant_id) {
        const redeemingMerchantId = redemption.redeeming_merchant_id;

        for (const alloc of allocations) {
          const fundingMerchantId = alloc.funding_merchant_id;
          const amount = alloc.amount_consumed_paise;

          // Funding merchant owes money
          const currentPayable = merchantPayables.get(fundingMerchantId) || 0;
          merchantPayables.set(fundingMerchantId, currentPayable + amount);

          // Redeeming merchant receives money
          const currentReceivable = merchantReceivables.get(redeemingMerchantId) || 0;
          merchantReceivables.set(redeemingMerchantId, currentReceivable + amount);
        }
      } else if (redemption.type === 'UPI_PAYOUT') {
        // For UPI Payout, funding merchants owe their share
        for (const alloc of allocations) {
          const fundingMerchantId = alloc.funding_merchant_id;
          const amount = alloc.amount_consumed_paise;

          const currentPayable = merchantPayables.get(fundingMerchantId) || 0;
          merchantPayables.set(fundingMerchantId, currentPayable + amount);

          // Customer payout receives the fund
          // To balance receivables in the settlement matrix for UPI payout, funding merchant payables match payout distribution
          const currentReceivable = merchantReceivables.get(fundingMerchantId) || 0;
          merchantReceivables.set(fundingMerchantId, currentReceivable + amount);
        }
      }
    }

    // Compute Net Settlement Positions for each Merchant
    const positions: MerchantLedgerPosition[] = [];
    const settlementLines: SettlementLine[] = [];

    for (const m of networkMerchants) {
      const receivable = merchantReceivables.get(m.id) || 0;
      const payable = merchantPayables.get(m.id) || 0;
      const netAmount = receivable - payable;

      let positionType: 'PAY' | 'RECEIVE' | 'BALANCED' = 'BALANCED';
      if (netAmount > 0) positionType = 'RECEIVE';
      else if (netAmount < 0) positionType = 'PAY';

      const pos: MerchantLedgerPosition = {
        id: randomUUID(),
        network_id: network.id,
        settlement_cycle_id: cycle.id,
        merchant_id: m.id,
        receivable_paise: receivable,
        payable_paise: payable,
        net_amount_paise: netAmount,
        position_type: positionType,
        created_at: now.toISOString()
      };

      positions.push(pos);
      db.merchantLedgers.set(pos.id, pos);
    }

    // MANDATORY RECONCILIATION CHECK (Total Payables == Total Receivables)
    ReconciliationService.verifySettlementBalance(cycle, positions);

    // If Reconciled successfully -> Generate Batch & Payment Instructions
    const batchId = randomUUID();
    let totalBatchAmount = 0;
    const paymentInstructions: PaymentInstruction[] = [];

    for (const pos of positions) {
      if (pos.net_amount_paise > 0) {
        // Merchant is owed money (PAYOUT)
        totalBatchAmount += pos.net_amount_paise;
        const merchant = db.merchants.get(pos.merchant_id);
        
        if (merchant) {
          const inst: PaymentInstruction = {
            id: randomUUID(),
            network_id: network.id,
            settlement_cycle_id: cycle.id,
            recipient_type: 'MERCHANT',
            recipient_id: merchant.id,
            amount_paise: pos.net_amount_paise,
            direction: 'PAYOUT',
            status: 'PENDING',
            idempotency_key: `SETTLE-PAYOUT-${cycle.id}-${merchant.id}`,
            created_at: now.toISOString()
          };

          const providerRes = await razorpayPaymentProvider.createMerchantSettlement({
            instruction_id: inst.id,
            merchant_id: merchant.id,
            amount_paise: inst.amount_paise,
            bank_details: merchant.bank_details
          });

          inst.provider_ref = providerRes.provider_ref;
          inst.status = providerRes.status;
          paymentInstructions.push(inst);
          db.paymentInstructions.set(inst.id, inst);
        }
      } else if (pos.net_amount_paise < 0) {
        // Merchant owes money (COLLECTION / INVOICING)
        totalBatchAmount += Math.abs(pos.net_amount_paise);
        const merchant = db.merchants.get(pos.merchant_id);
        
        if (merchant) {
          const inst: PaymentInstruction = {
            id: randomUUID(),
            network_id: network.id,
            settlement_cycle_id: cycle.id,
            recipient_type: 'MERCHANT',
            recipient_id: merchant.id,
            amount_paise: Math.abs(pos.net_amount_paise),
            direction: 'COLLECTION',
            status: 'PENDING',
            idempotency_key: `SETTLE-COLL-${cycle.id}-${merchant.id}`,
            created_at: now.toISOString()
          };

          const providerRes = await razorpayPaymentProvider.createPaymentLink({
            instruction_id: inst.id,
            merchant_id: merchant.id,
            amount_paise: inst.amount_paise,
            customer_name: merchant.name,
            description: `Settlement Invoice for Cycle ${cycle.id}`
          });

          inst.provider_ref = providerRes.provider_ref;
          inst.status = providerRes.status;
          inst.payment_link_url = providerRes.payment_link_url;
          paymentInstructions.push(inst);
          db.paymentInstructions.set(inst.id, inst);
        }
      }
    }

    const batch: SettlementBatch = {
      id: batchId,
      settlement_cycle_id: cycle.id,
      network_id: network.id,
      status: 'GENERATED',
      total_amount_paise: totalBatchAmount,
      instruction_count: paymentInstructions.length,
      reconciled_at: cycle.reconciled_at || now.toISOString(),
      created_at: now.toISOString()
    };

    db.settlementBatches.set(batch.id, batch);
    cycle.status = 'SETTLED';
    db.settlementCycles.set(cycle.id, cycle);

    return {
      cycle,
      positions,
      settlement_lines: settlementLines,
      batch,
      payment_instructions: paymentInstructions
    };
  }

  static getSettlementCycle(id: string): SettlementCycle {
    const cycle = db.settlementCycles.get(id);
    if (!cycle) {
      throw new NotFoundError(`Settlement cycle '${id}' not found.`);
    }
    return cycle;
  }

  static getMerchantPosition(merchantId: string): MerchantLedgerPosition[] {
    const list: MerchantLedgerPosition[] = [];
    for (const pos of db.merchantLedgers.values()) {
      if (pos.merchant_id === merchantId) {
        list.push(pos);
      }
    }
    return list;
  }
}
