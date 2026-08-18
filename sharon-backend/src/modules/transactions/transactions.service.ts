import { randomUUID } from 'crypto';
import { RewardLedgerEntry, RewardLot, Transaction } from '../../common/types';
import { db } from '../../database/db';
import { Money } from '../../common/money';
import { IdempotencyError, IdempotencyManager } from '../../common/idempotency';
import { NetworkIsolationError, ValidationError } from '../../common/errors';
import { NetworksService } from '../networks/networks.service';
import { MerchantsService } from '../merchants/merchants.service';
import { CustomersService } from '../customers/customers.service';

export class TransactionsService {
  static processTransaction(data: {
    id?: string;
    network_id: string;
    merchant_id: string;
    customer_id: string;
    amount_paise: number;
    idempotency_key: string;
  }): { transaction: Transaction; reward_lot: RewardLot } {
    if (!data.network_id || !data.merchant_id || !data.customer_id || !data.amount_paise || !data.idempotency_key) {
      throw new ValidationError('network_id, merchant_id, customer_id, amount_paise, and idempotency_key are required.');
    }

    Money.assertInteger(data.amount_paise, 'Transaction amount_paise');

    // Idempotency check
    const existing = IdempotencyManager.get(data.idempotency_key);
    if (existing) {
      return existing.response;
    }

    // Verify Network Isolation & Existence
    const network = NetworksService.getNetwork(data.network_id);
    const merchant = MerchantsService.getMerchant(data.merchant_id);
    const customer = CustomersService.getCustomer(data.customer_id);

    if (merchant.network_id !== network.id) {
      throw new NetworkIsolationError(`Merchant '${merchant.id}' belongs to network '${merchant.network_id}', not '${network.id}'.`);
    }

    if (customer.network_id !== network.id) {
      throw new NetworkIsolationError(`Customer '${customer.id}' belongs to network '${customer.network_id}', not '${network.id}'.`);
    }

    // Calculate reward rate bps (Merchant override or Network default)
    const rewardRateBps = merchant.reward_rate_bps ?? network.reward_rate_bps;
    const rewardAmountPaise = Money.calculateReward(data.amount_paise, rewardRateBps);

    const transactionId = data.id || randomUUID();
    const transaction: Transaction = {
      id: transactionId,
      network_id: network.id,
      merchant_id: merchant.id,
      customer_id: customer.id,
      amount_paise: data.amount_paise,
      reward_amount_paise: rewardAmountPaise,
      status: 'COMPLETED',
      idempotency_key: data.idempotency_key,
      created_at: new Date().toISOString()
    };

    db.transactions.set(transaction.id, transaction);

    // Create Reward Lot retaining source funding merchant ID
    const rewardLot: RewardLot = {
      id: `LOT-${randomUUID().substring(0, 8)}`,
      network_id: network.id,
      customer_id: customer.id,
      funding_merchant_id: merchant.id,
      transaction_id: transaction.id,
      initial_amount_paise: rewardAmountPaise,
      available_amount_paise: rewardAmountPaise,
      status: 'AVAILABLE',
      created_at: new Date().toISOString()
    };

    db.rewardLots.set(rewardLot.id, rewardLot);

    // Create Immutable Ledger Entry
    const ledgerEntry: RewardLedgerEntry = {
      id: randomUUID(),
      network_id: network.id,
      customer_id: customer.id,
      merchant_id: merchant.id,
      transaction_id: transaction.id,
      amount_paise: rewardAmountPaise,
      currency: network.currency,
      event_type: 'REWARD_EARNED',
      reference_id: rewardLot.id,
      metadata: { purchase_amount_paise: data.amount_paise, reward_rate_bps: rewardRateBps },
      idempotency_key: data.idempotency_key,
      created_at: new Date().toISOString()
    };

    db.rewardLedger.set(ledgerEntry.id, ledgerEntry);

    const result = { transaction, reward_lot: rewardLot };
    IdempotencyManager.save(data.idempotency_key, result);
    return result;
  }

  static getTransaction(id: string): Transaction {
    const tx = db.transactions.get(id);
    if (!tx) {
      throw new ValidationError(`Transaction '${id}' not found.`);
    }
    return tx;
  }
}
