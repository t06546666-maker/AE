import { randomUUID } from 'crypto';
import { Refund, Reversal, RewardLedgerEntry } from '../../common/types';
import { db } from '../../database/db';
import { Money } from '../../common/money';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { IdempotencyManager } from '../../common/idempotency';
import { TransactionsService } from '../transactions/transactions.service';
import { MerchantsService } from '../merchants/merchants.service';
import { NetworksService } from '../networks/networks.service';

export class RefundsService {
  static processRefund(data: {
    transaction_id: string;
    refund_amount_paise: number;
    reason: string;
    idempotency_key: string;
  }): { refund: Refund; reversal?: Reversal } {
    if (!data.transaction_id || !data.refund_amount_paise || !data.idempotency_key) {
      throw new ValidationError('transaction_id, refund_amount_paise, and idempotency_key are required.');
    }

    Money.assertInteger(data.refund_amount_paise, 'Refund amount_paise');

    const existing = IdempotencyManager.get(data.idempotency_key);
    if (existing) {
      return existing.response;
    }

    const tx = TransactionsService.getTransaction(data.transaction_id);
    if (data.refund_amount_paise > tx.amount_paise) {
      throw new ValidationError(`Refund amount ${Money.format(data.refund_amount_paise)} exceeds original purchase amount ${Money.format(tx.amount_paise)}.`);
    }

    const merchant = MerchantsService.getMerchant(tx.merchant_id);
    const network = NetworksService.getNetwork(tx.network_id);

    const rewardRateBps = merchant.reward_rate_bps ?? network.reward_rate_bps;
    const rewardReversedPaise = Money.calculateReward(data.refund_amount_paise, rewardRateBps);

    const refund: Refund = {
      id: randomUUID(),
      transaction_id: tx.id,
      network_id: tx.network_id,
      merchant_id: tx.merchant_id,
      customer_id: tx.customer_id,
      amount_paise: data.refund_amount_paise,
      reward_reversed_paise: rewardReversedPaise,
      reason: data.reason || 'Customer refund',
      idempotency_key: data.idempotency_key,
      created_at: new Date().toISOString()
    };

    db.refunds.set(refund.id, refund);

    // Update Transaction status
    if (data.refund_amount_paise === tx.amount_paise) {
      tx.status = 'REFUNDED';
    } else {
      tx.status = 'PARTIALLY_REFUNDED';
    }
    db.transactions.set(tx.id, tx);

    // Find associated RewardLot
    let reversal: Reversal | undefined;
    for (const lot of db.rewardLots.values()) {
      if (lot.transaction_id === tx.id) {
        const reverseAmount = Math.min(lot.available_amount_paise, rewardReversedPaise);
        lot.available_amount_paise -= reverseAmount;
        if (lot.available_amount_paise === 0) {
          lot.status = 'REVERSED';
        }
        db.rewardLots.set(lot.id, lot);

        reversal = {
          id: randomUUID(),
          refund_id: refund.id,
          reward_lot_id: lot.id,
          reversed_amount_paise: reverseAmount,
          created_at: new Date().toISOString()
        };
        db.reversals.set(reversal.id, reversal);
        break;
      }
    }

    // Ledger Entry REWARD_REVERSED
    const ledgerReversed: RewardLedgerEntry = {
      id: randomUUID(),
      network_id: tx.network_id,
      customer_id: tx.customer_id,
      merchant_id: tx.merchant_id,
      transaction_id: tx.id,
      amount_paise: rewardReversedPaise,
      currency: network.currency,
      event_type: 'REWARD_REVERSED',
      reference_id: refund.id,
      idempotency_key: `${data.idempotency_key}-REVERSAL`,
      created_at: new Date().toISOString()
    };

    db.rewardLedger.set(ledgerReversed.id, ledgerReversed);

    const result = { refund, reversal };
    IdempotencyManager.save(data.idempotency_key, result);
    return result;
  }
}
