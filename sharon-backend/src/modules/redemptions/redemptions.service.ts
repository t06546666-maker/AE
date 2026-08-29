import { randomUUID } from 'crypto';
import {
  PaymentInstruction,
  Redemption,
  RedemptionAllocation,
  RedemptionType,
  RewardLedgerEntry
} from '../../common/types';
import { db } from '../../database/db';
import { Money } from '../../common/money';
import { InsufficientBalanceError, NotFoundError, ValidationError } from '../../common/errors';
import { IdempotencyManager } from '../../common/idempotency';
import { CustomersService } from '../customers/customers.service';
import { NetworksService } from '../networks/networks.service';
import { MerchantsService } from '../merchants/merchants.service';
import { RewardsService } from '../rewards/rewards.service';
import { razorpayPaymentProvider } from '../payments/razorpay-payment-provider';

export class RedemptionsService {
  static async requestRedemption(data: {
    id?: string;
    customer_id: string;
    type: RedemptionType;
    amount_paise: number;
    idempotency_key: string;
    upi_id?: string;
  }): Promise<{ redemption: Redemption; allocations: RedemptionAllocation[]; payment_instruction?: PaymentInstruction }> {
    if (!data.customer_id || !data.type || !data.amount_paise || !data.idempotency_key) {
      throw new ValidationError('customer_id, type, amount_paise, and idempotency_key are required.');
    }

    Money.assertInteger(data.amount_paise, 'Redemption amount_paise');

    // Idempotency check
    const existing = IdempotencyManager.get(data.idempotency_key);
    if (existing) {
      return existing.response;
    }

    const customer = CustomersService.getCustomer(data.customer_id);
    const network = NetworksService.getNetwork(customer.network_id);

    // Verify minimum redemption threshold (default ₹100 / 10000 paise)
    if (data.amount_paise < network.min_redemption_threshold_paise) {
      throw new ValidationError(
        `Redemption amount ${Money.format(data.amount_paise)} is below minimum threshold ${Money.format(network.min_redemption_threshold_paise)}.`
      );
    }

    // Check available balance
    const summary = RewardsService.getCustomerRewardSummary(customer.id);
    if (summary.total_available_paise < data.amount_paise) {
      throw new InsufficientBalanceError(
        `Available balance ${Money.format(summary.total_available_paise)} is insufficient for requested ${Money.format(data.amount_paise)} redemption.`
      );
    }

    const redemptionId = data.id || randomUUID();
    const redemption: Redemption = {
      id: redemptionId,
      network_id: network.id,
      customer_id: customer.id,
      type: data.type,
      amount_paise: data.amount_paise,
      status: 'RESERVED',
      idempotency_key: data.idempotency_key,
      created_at: new Date().toISOString()
    };

    db.redemptions.set(redemption.id, redemption);

    // FIFO Lot Consumption & Reservation
    const availableLots = RewardsService.getCustomerRewardLots(customer.id).filter(l => l.status === 'AVAILABLE');

    let remainingToConsume = data.amount_paise;
    const allocations: RedemptionAllocation[] = [];

    for (const lot of availableLots) {
      if (remainingToConsume <= 0) break;

      const consumeFromLot = Math.min(lot.available_amount_paise, remainingToConsume);
      lot.available_amount_paise -= consumeFromLot;
      remainingToConsume -= consumeFromLot;

      if (lot.available_amount_paise === 0) {
        lot.status = 'RESERVED';
      } else {
        lot.status = 'AVAILABLE';
      }
      db.rewardLots.set(lot.id, lot);

      const allocation: RedemptionAllocation = {
        id: randomUUID(),
        redemption_id: redemption.id,
        reward_lot_id: lot.id,
        funding_merchant_id: lot.funding_merchant_id,
        amount_consumed_paise: consumeFromLot,
        created_at: new Date().toISOString()
      };

      allocations.push(allocation);
      db.redemptionAllocations.set(allocation.id, allocation);
    }

    // Create Immutable Reserved Ledger Entry
    const ledgerReserved: RewardLedgerEntry = {
      id: randomUUID(),
      network_id: network.id,
      customer_id: customer.id,
      amount_paise: data.amount_paise,
      currency: network.currency,
      event_type: 'REWARD_RESERVED',
      reference_id: redemption.id,
      idempotency_key: `${data.idempotency_key}-RESERVE`,
      created_at: new Date().toISOString()
    };
    db.rewardLedger.set(ledgerReserved.id, ledgerReserved);

    let paymentInstruction: PaymentInstruction | undefined;

    if (data.type === 'UPI_PAYOUT') {
      const upiId = data.upi_id || customer.upi_id || 'customer@upi';
      const instructionId = randomUUID();
      
      paymentInstruction = {
        id: instructionId,
        network_id: network.id,
        redemption_id: redemption.id,
        recipient_type: 'CUSTOMER',
        recipient_id: customer.id,
        amount_paise: data.amount_paise,
        status: 'PENDING',
        idempotency_key: `${data.idempotency_key}-PAYOUT`,
        created_at: new Date().toISOString()
      };

      db.paymentInstructions.set(paymentInstruction.id, paymentInstruction);

      // Execute via PaymentProvider Adapter
      const providerRes = await razorpayPaymentProvider.createCustomerPayout({
        instruction_id: paymentInstruction.id,
        amount_paise: data.amount_paise,
        upi_id: upiId
      });

      paymentInstruction.provider_ref = providerRes.provider_ref;
      paymentInstruction.status = providerRes.status;
      db.paymentInstructions.set(paymentInstruction.id, paymentInstruction);

      if (providerRes.status === 'SUCCESS') {
        redemption.status = 'COMPLETED';
        redemption.payout_instruction_id = paymentInstruction.id;
        db.redemptions.set(redemption.id, redemption);

        // Update lots to EXHAUSTED if available balance is 0
        for (const alloc of allocations) {
          const lot = db.rewardLots.get(alloc.reward_lot_id);
          if (lot && lot.available_amount_paise === 0) {
            lot.status = 'EXHAUSTED';
            db.rewardLots.set(lot.id, lot);
          }
          
          // Auto top-up to compensate merchant
          const merchant = MerchantsService.getMerchant(alloc.funding_merchant_id);
          const autoTopUpPoints = Math.floor(alloc.amount_consumed_paise / 100);
          merchant.point_balance += autoTopUpPoints;
          db.merchants.set(merchant.id, merchant);
        }

        // Ledger Entry REWARD_REDEEMED
        const ledgerRedeemed: RewardLedgerEntry = {
          id: randomUUID(),
          network_id: network.id,
          customer_id: customer.id,
          amount_paise: data.amount_paise,
          currency: network.currency,
          event_type: 'REWARD_REDEEMED',
          reference_id: redemption.id,
          idempotency_key: `${data.idempotency_key}-REDEEMED`,
          created_at: new Date().toISOString()
        };
        db.rewardLedger.set(ledgerRedeemed.id, ledgerRedeemed);
      } else if (providerRes.status === 'FAILED') {
        // Release reservation back to AVAILABLE
        redemption.status = 'FAILED';
        db.redemptions.set(redemption.id, redemption);

        for (const alloc of allocations) {
          const lot = db.rewardLots.get(alloc.reward_lot_id);
          if (lot) {
            lot.available_amount_paise += alloc.amount_consumed_paise;
            lot.status = 'AVAILABLE';
            db.rewardLots.set(lot.id, lot);
          }
        }

        const ledgerReleased: RewardLedgerEntry = {
          id: randomUUID(),
          network_id: network.id,
          customer_id: customer.id,
          amount_paise: data.amount_paise,
          currency: network.currency,
          event_type: 'REWARD_RELEASED',
          reference_id: redemption.id,
          idempotency_key: `${data.idempotency_key}-RELEASED`,
          created_at: new Date().toISOString()
        };
        db.rewardLedger.set(ledgerReleased.id, ledgerReleased);
      }
    }

    const result = { redemption, allocations, payment_instruction: paymentInstruction };
    IdempotencyManager.save(data.idempotency_key, result);
    return result;
  }

  static getRedemption(id: string): Redemption {
    const r = db.redemptions.get(id);
    if (!r) {
      throw new NotFoundError(`Redemption '${id}' not found.`);
    }
    return r;
  }

  static getRedemptionAllocations(redemptionId: string): RedemptionAllocation[] {
    const list: RedemptionAllocation[] = [];
    for (const a of db.redemptionAllocations.values()) {
      if (a.redemption_id === redemptionId) {
        list.push(a);
      }
    }
    return list;
  }
}
