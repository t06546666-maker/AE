# Payment Provider Abstraction Layer

## PaymentProvider Interface

Sharon provides a decoupled abstraction layer for payment rails:

```typescript
export interface PaymentProvider {
  createCustomerPayout(request: CustomerPayoutRequest): Promise<PaymentProviderResponse>;
  createMerchantSettlement(request: MerchantSettlementRequest): Promise<PaymentProviderResponse>;
  getPaymentStatus(provider_ref: string): Promise<PaymentStatus>;
  handleCallback(payload: any): Promise<{ instruction_id: string; status: PaymentStatus }>;
  verifyCallback(signature: string, payload: any): boolean;
}
```

## MockPaymentProvider
Included in `src/modules/payments/mock-payment-provider.ts` for sandbox development. Simulates `PENDING`, `SUCCESS`, and `FAILED` states cleanly.
