/**
 * Core Type Definitions for Sharon Rewards Settlement Engine
 * All monetary values are strictly represented in integer minor units (paise for INR).
 * Example: INR 100.00 = 10000 paise.
 */

export type Currency = 'INR';

export type MerchantStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED';

export type RewardLotStatus = 'AVAILABLE' | 'RESERVED' | 'EXHAUSTED' | 'REVERSED';

export type RewardEventType =
  | 'REWARD_EARNED'
  | 'REWARD_REVERSED'
  | 'REWARD_RESERVED'
  | 'REWARD_RELEASED'
  | 'REWARD_REDEEMED'
  | 'REFUND'
  | 'SETTLEMENT_CREATED'
  | 'SETTLEMENT_PAID'
  | 'SETTLEMENT_FAILED';

export type RedemptionType = 'UPI_PAYOUT' | 'NETWORK_VOUCHER';

export type RedemptionStatus =
  | 'REQUESTED'
  | 'RESERVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type VoucherStatus =
  | 'ISSUED'
  | 'PARTIALLY_REDEEMED'
  | 'FULLY_REDEEMED'
  | 'EXPIRED'
  | 'CANCELLED';

export type SettlementCycleStatus =
  | 'OPEN'
  | 'FROZEN'
  | 'CALCULATING'
  | 'RECONCILED'
  | 'RECONCILIATION_FAILED'
  | 'BATCH_GENERATED'
  | 'SETTLED'
  | 'EXCEPTION';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export type PositionType = 'PAY' | 'RECEIVE' | 'BALANCED';

export interface Network {
  id: string;
  code: string;
  name: string;
  currency: Currency;
  reward_rate_bps: number; // Basis points (1% = 100 bps)
  min_redemption_threshold_paise: number; // Default 10000 paise (₹100)
  created_at: string;
}

export interface BankDetails {
  account_number: string;
  ifsc: string;
  account_holder_name: string;
  upi_id?: string;
}

export interface Merchant {
  id: string;
  network_id: string;
  code: string;
  name: string;
  status: MerchantStatus;
  bank_details: BankDetails;
  reward_rate_bps?: number; // Optional merchant-specific override
  point_balance: number; // Prepaid points for rewards (1 point = 1rs)
  subscription_expires_at?: string; // ISO string when monthly subscription ends
  subscription_mandate_id?: string; // Razorpay recurring mandate ID for autopay
  created_at: string;
}

export interface MerchantUser {
  id: string;
  merchant_id: string;
  username: string;
  role: 'ADMIN' | 'MERCHANT_ADMIN' | 'MERCHANT_STAFF';
  password_hash: string;
  created_at: string;
}

export interface Customer {
  id: string;
  network_id: string;
  phone: string;
  name: string;
  upi_id?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  network_id: string;
  merchant_id: string;
  customer_id: string;
  amount_paise: number;
  reward_amount_paise: number;
  status: 'COMPLETED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  idempotency_key: string;
  created_at: string;
}

export interface RewardRule {
  id: string;
  network_id: string;
  merchant_id?: string;
  reward_rate_bps: number;
  active: boolean;
  created_at: string;
}

export interface RewardLot {
  id: string;
  network_id: string;
  customer_id: string;
  funding_merchant_id: string;
  transaction_id: string;
  initial_amount_paise: number;
  available_amount_paise: number;
  status: RewardLotStatus;
  created_at: string;
}

export interface RewardLedgerEntry {
  id: string;
  network_id: string;
  customer_id?: string;
  merchant_id?: string;
  transaction_id?: string;
  amount_paise: number;
  currency: Currency;
  event_type: RewardEventType;
  reference_id?: string;
  metadata?: Record<string, any>;
  idempotency_key: string;
  created_at: string;
}

export interface Redemption {
  id: string;
  network_id: string;
  customer_id: string;
  type: RedemptionType;
  amount_paise: number;
  status: RedemptionStatus;
  redeeming_merchant_id?: string;
  payout_instruction_id?: string;
  idempotency_key: string;
  created_at: string;
}

export interface RedemptionAllocation {
  id: string;
  redemption_id: string;
  reward_lot_id: string;
  funding_merchant_id: string;
  amount_consumed_paise: number;
  created_at: string;
}

export interface MerchantLedgerPosition {
  id: string;
  network_id: string;
  settlement_cycle_id: string;
  merchant_id: string;
  receivable_paise: number;
  payable_paise: number;
  net_amount_paise: number;
  position_type: PositionType;
  created_at: string;
}

export interface SettlementCycle {
  id: string;
  network_id: string;
  period_start: string;
  period_end: string;
  status: SettlementCycleStatus;
  total_payables_paise: number;
  total_receivables_paise: number;
  reconciled_at?: string;
  created_at: string;
}

export interface SettlementLine {
  id: string;
  settlement_cycle_id: string;
  network_id: string;
  from_merchant_id: string;
  to_merchant_id: string;
  amount_paise: number;
  created_at: string;
}

export interface SettlementBatch {
  id: string;
  settlement_cycle_id: string;
  network_id: string;
  status: 'GENERATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total_amount_paise: number;
  instruction_count: number;
  reconciled_at: string;
  created_at: string;
}

export interface PaymentInstruction {
  id: string;
  network_id: string;
  redemption_id?: string;
  settlement_cycle_id?: string;
  recipient_type: 'CUSTOMER' | 'MERCHANT';
  recipient_id: string;
  amount_paise: number;
  direction?: 'PAYOUT' | 'COLLECTION';
  payment_link_url?: string;
  status: PaymentStatus;
  provider_ref?: string;
  idempotency_key: string;
  created_at: string;
}

export interface PaymentResult {
  id: string;
  payment_instruction_id: string;
  provider_status: PaymentStatus;
  raw_payload?: Record<string, any>;
  created_at: string;
}

export interface Voucher {
  id: string;
  network_id: string;
  customer_id: string;
  redemption_id: string;
  code: string;
  original_value_paise: number;
  remaining_value_paise: number;
  status: VoucherStatus;
  issued_at: string;
  expires_at: string;
  redeemed_at?: string;
  redeeming_merchant_id?: string;
}

export interface VoucherRedemption {
  id: string;
  voucher_id: string;
  redeeming_merchant_id: string;
  amount_redeemed_paise: number;
  redeemed_at: string;
}

export interface Refund {
  id: string;
  transaction_id: string;
  network_id: string;
  merchant_id: string;
  customer_id: string;
  amount_paise: number;
  reward_reversed_paise: number;
  reason: string;
  idempotency_key: string;
  created_at: string;
}

export interface Reversal {
  id: string;
  refund_id: string;
  reward_lot_id: string;
  reversed_amount_paise: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  network_id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  details: Record<string, any>;
  created_at: string;
}
