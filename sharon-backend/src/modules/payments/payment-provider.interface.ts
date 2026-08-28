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

export interface PaymentLinkRequest {
  instruction_id: string;
  merchant_id: string;
  amount_paise: number;
  customer_name: string;
  description: string;
}

export interface PaymentProviderResponse {
  provider_ref: string;
  status: PaymentStatus;
  payment_link_url?: string;
}

export interface PaymentProvider {
  createCustomerPayout(request: CustomerPayoutRequest): Promise<PaymentProviderResponse>;
  createMerchantSettlement(request: MerchantSettlementRequest): Promise<PaymentProviderResponse>;
  createPaymentLink(request: PaymentLinkRequest): Promise<PaymentProviderResponse>;
  getPaymentStatus(provider_ref: string): Promise<PaymentStatus>;
  handleCallback(payload: any): Promise<{ instruction_id: string; status: PaymentStatus }>;
  verifyCallback(signature: string, payload: any): boolean;
}
