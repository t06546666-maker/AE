import { db } from '../database/db';
import { Logger } from '../common/logger';

export class VoucherExpiryJob {
  static processExpiredVouchers(): number {
    Logger.info('[Job] Checking for expired vouchers...');
    const now = Date.now();
    let count = 0;
    for (const v of db.vouchers.values()) {
      if ((v.status === 'ISSUED' || v.status === 'PARTIALLY_REDEEMED') && new Date(v.expires_at).getTime() < now) {
        v.status = 'EXPIRED';
        db.vouchers.set(v.id, v);
        count++;
        Logger.info(`[Job] Voucher '${v.code}' marked EXPIRED.`);
      }
    }
    return count;
  }
}
