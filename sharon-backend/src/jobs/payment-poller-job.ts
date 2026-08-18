import { db } from '../database/db';
import { mockPaymentProvider } from '../modules/payments/mock-payment-provider';
import { Logger } from '../common/logger';

export class PaymentPollerJob {
  static async pollPendingPayments(): Promise<number> {
    Logger.info('[Job] Polling pending payment instructions...');
    let processed = 0;
    for (const inst of db.paymentInstructions.values()) {
      if (inst.status === 'PENDING' && inst.provider_ref) {
        const newStatus = await mockPaymentProvider.getPaymentStatus(inst.provider_ref);
        if (newStatus !== inst.status) {
          inst.status = newStatus;
          db.paymentInstructions.set(inst.id, inst);
          processed++;
          Logger.info(`[Job] Updated payment instruction ${inst.id} to status ${newStatus}`);
        }
      }
    }
    return processed;
  }
}
