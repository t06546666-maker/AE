import { BankDetails, PaymentStatus } from '../../common/types';

export interface CustomerPayoutRequest {
  instruction_id: string;
  amount_paise: number;
  upi_id?: string;
  bank_details?: BankDetails;
}

export interface MerchantSettlementRequest {
  instruction_id: string;
  merchant_id: string;
  amount_paise: number;
  bank_details: BankDetails;
}

export interface PaymentProviderResponse {
  provider_ref: string;
  status: PaymentStatus;
}

export interface PaymentProvider {
  createCustomerPayout(request: CustomerPayoutRequest): Promise<PaymentProviderResponse>;
  createMerchantSettlement(request: MerchantSettlementRequest): Promise<PaymentProviderResponse>;
  getPaymentStatus(provider_ref: string): Promise<PaymentStatus>;
  handleCallback(payload: any): Promise<{ instruction_id: string; status: PaymentStatus }>;
  verifyCallback(signature: string, payload: any): boolean;
}
