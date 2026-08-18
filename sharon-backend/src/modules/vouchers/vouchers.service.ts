import { randomUUID } from 'crypto';
import { Voucher, VoucherRedemption } from '../../common/types';
import { db } from '../../database/db';
import { ConflictError, NetworkIsolationError, NotFoundError, ValidationError } from '../../common/errors';
import { RedemptionsService } from '../redemptions/redemptions.service';
import { MerchantsService } from '../merchants/merchants.service';
import { Money } from '../../common/money';

export class VouchersService {
  static async issueVoucher(data: {
    customer_id: string;
    amount_paise: number;
    idempotency_key: string;
    expiry_days?: number;
  }): Promise<Voucher> {
    // 1. Initiate Redemption of type NETWORK_VOUCHER
    const redemptionResult = await RedemptionsService.requestRedemption({
      customer_id: data.customer_id,
      type: 'NETWORK_VOUCHER',
      amount_paise: data.amount_paise,
      idempotency_key: data.idempotency_key
    });

    const redemption = redemptionResult.redemption;
    redemption.status = 'COMPLETED';
    db.redemptions.set(redemption.id, redemption);

    // Update consumed lots to EXHAUSTED if available balance is 0
    for (const alloc of redemptionResult.allocations) {
      const lot = db.rewardLots.get(alloc.reward_lot_id);
      if (lot && lot.available_amount_paise === 0) {
        lot.status = 'EXHAUSTED';
        db.rewardLots.set(lot.id, lot);
      }
    }

    const expiryDays = data.expiry_days || 90;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

    const code = `VOUCH-${randomUUID().substring(0, 8).toUpperCase()}`;

    const voucher: Voucher = {
      id: randomUUID(),
      network_id: redemption.network_id,
      customer_id: redemption.customer_id,
      redemption_id: redemption.id,
      code,
      original_value_paise: redemption.amount_paise,
      remaining_value_paise: redemption.amount_paise,
      status: 'ISSUED',
      issued_at: new Date().toISOString(),
      expires_at: expiresAt
    };

    db.vouchers.set(voucher.id, voucher);
    return voucher;
  }

  static getVoucher(idOrCode: string): Voucher {
    let v = db.vouchers.get(idOrCode);
    if (!v) {
      for (const item of db.vouchers.values()) {
        if (item.code === idOrCode) {
          v = item;
          break;
        }
      }
    }

    if (!v) {
      throw new NotFoundError(`Voucher '${idOrCode}' not found.`);
    }
    return v;
  }

  static redeemVoucher(data: {
    voucher_id: string;
    redeeming_merchant_id: string;
    amount_paise?: number;
  }): { voucher: Voucher; redemption_record: VoucherRedemption } {
    if (!data.voucher_id || !data.redeeming_merchant_id) {
      throw new ValidationError('voucher_id and redeeming_merchant_id are required.');
    }

    const voucher = this.getVoucher(data.voucher_id);
    const merchant = MerchantsService.getMerchant(data.redeeming_merchant_id);

    // Network Isolation Check
    if (merchant.network_id !== voucher.network_id) {
      throw new NetworkIsolationError(`Redeeming merchant '${merchant.id}' network does not match voucher network.`);
    }

    // Double Redemption / Validity Check
    if (voucher.status === 'FULLY_REDEEMED' || voucher.remaining_value_paise <= 0) {
      throw new ConflictError(`Voucher '${voucher.code}' has already been fully redeemed.`);
    }

    if (voucher.status === 'EXPIRED' || new Date(voucher.expires_at).getTime() < Date.now()) {
      voucher.status = 'EXPIRED';
      db.vouchers.set(voucher.id, voucher);
      throw new ConflictError(`Voucher '${voucher.code}' has expired.`);
    }

    if (voucher.status === 'CANCELLED') {
      throw new ConflictError(`Voucher '${voucher.code}' is cancelled.`);
    }

    const redeemAmount = data.amount_paise || voucher.remaining_value_paise;
    Money.assertInteger(redeemAmount, 'Voucher redeem amount');

    if (redeemAmount > voucher.remaining_value_paise) {
      throw new ValidationError(`Redeem amount ${Money.format(redeemAmount)} exceeds remaining voucher value ${Money.format(voucher.remaining_value_paise)}.`);
    }

    voucher.remaining_value_paise -= redeemAmount;
    voucher.redeemed_at = new Date().toISOString();
    voucher.redeeming_merchant_id = merchant.id;

    if (voucher.remaining_value_paise === 0) {
      voucher.status = 'FULLY_REDEEMED';
    } else {
      voucher.status = 'PARTIALLY_REDEEMED';
    }

    db.vouchers.set(voucher.id, voucher);

    // Also update the underlying Redemption object to point to the redeeming merchant
    const redemption = db.redemptions.get(voucher.redemption_id);
    if (redemption) {
      redemption.redeeming_merchant_id = merchant.id;
      db.redemptions.set(redemption.id, redemption);
    }

    const record: VoucherRedemption = {
      id: randomUUID(),
      voucher_id: voucher.id,
      redeeming_merchant_id: merchant.id,
      amount_redeemed_paise: redeemAmount,
      redeemed_at: voucher.redeemed_at
    };

    db.voucherRedemptions.set(record.id, record);

    return { voucher, redemption_record: record };
  }
}
