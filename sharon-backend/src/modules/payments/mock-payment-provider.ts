import { randomUUID } from 'crypto';
import { PaymentStatus } from '../../common/types';
import {
  CustomerPayoutRequest,
  MerchantSettlementRequest,
  PaymentProvider,
  PaymentProviderResponse
} from './payment-provider.interface';
import { Logger } from '../../common/logger';

export class MockPaymentProvider implements PaymentProvider {
  private simulateStatus: PaymentStatus = 'SUCCESS';
  private transactionsMap = new Map<string, PaymentStatus>();

  public setSimulatedStatus(status: PaymentStatus): void {
    this.simulateStatus = status;
  }

  async createCustomerPayout(request: CustomerPayoutRequest): Promise<PaymentProviderResponse> {
    const provider_ref = `MOCK-CUST-${randomUUID().substring(0, 8)}`;
    Logger.info(`[MockPaymentProvider] Creating Customer Payout`, {
      instruction_id: request.instruction_id,
      amount_paise: request.amount_paise,
      provider_ref,
      status: this.simulateStatus
    });

    this.transactionsMap.set(provider_ref, this.simulateStatus);
    return {
      provider_ref,
      status: this.simulateStatus
    };
  }

  async createMerchantSettlement(request: MerchantSettlementRequest): Promise<PaymentProviderResponse> {
    const provider_ref = `MOCK-MERCH-${randomUUID().substring(0, 8)}`;
    Logger.info(`[MockPaymentProvider] Creating Merchant Settlement`, {
      instruction_id: request.instruction_id,
      merchant_id: request.merchant_id,
      amount_paise: request.amount_paise,
      provider_ref,
      status: this.simulateStatus
    });

    this.transactionsMap.set(provider_ref, this.simulateStatus);
    return {
      provider_ref,
      status: this.simulateStatus
    };
  }

  async getPaymentStatus(provider_ref: string): Promise<PaymentStatus> {
    return this.transactionsMap.get(provider_ref) || 'SUCCESS';
  }

  async handleCallback(payload: any): Promise<{ instruction_id: string; status: PaymentStatus }> {
    return {
      instruction_id: payload.instruction_id || payload.reference_id,
      status: payload.status as PaymentStatus
    };
  }

  verifyCallback(signature: string, payload: any): boolean {
    return true; // Sandbox always valid signature
  }
}

export const mockPaymentProvider = new MockPaymentProvider();
