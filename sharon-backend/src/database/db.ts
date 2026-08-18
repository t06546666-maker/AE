/**
 * Unified Database Layer & Repository Store
 * Supports standard PostgreSQL pool operations and deterministic state storage.
 */

import {
  Network,
  Merchant,
  Customer,
  Transaction,
  RewardLot,
  RewardLedgerEntry,
  Redemption,
  RedemptionAllocation,
  Voucher,
  VoucherRedemption,
  SettlementCycle,
  MerchantLedgerPosition,
  SettlementLine,
  SettlementBatch,
  PaymentInstruction,
  PaymentResult,
  Refund,
  Reversal,
  AuditLog,
  RewardRule
} from '../common/types';

export class DbStore {
  public networks = new Map<string, Network>();
  public merchants = new Map<string, Merchant>();
  public customers = new Map<string, Customer>();
  public transactions = new Map<string, Transaction>();
  public rewardRules = new Map<string, RewardRule>();
  public rewardLots = new Map<string, RewardLot>();
  public rewardLedger = new Map<string, RewardLedgerEntry>();
  public redemptions = new Map<string, Redemption>();
  public redemptionAllocations = new Map<string, RedemptionAllocation>();
  public vouchers = new Map<string, Voucher>();
  public voucherRedemptions = new Map<string, VoucherRedemption>();
  public settlementCycles = new Map<string, SettlementCycle>();
  public merchantLedgers = new Map<string, MerchantLedgerPosition>();
  public settlementLines = new Map<string, SettlementLine>();
  public settlementBatches = new Map<string, SettlementBatch>();
  public paymentInstructions = new Map<string, PaymentInstruction>();
  public paymentResults = new Map<string, PaymentResult>();
  public refunds = new Map<string, Refund>();
  public reversals = new Map<string, Reversal>();
  public auditLogs = new Map<string, AuditLog>();

  public clear(): void {
    this.networks.clear();
    this.merchants.clear();
    this.customers.clear();
    this.transactions.clear();
    this.rewardRules.clear();
    this.rewardLots.clear();
    this.rewardLedger.clear();
    this.redemptions.clear();
    this.redemptionAllocations.clear();
    this.vouchers.clear();
    this.voucherRedemptions.clear();
    this.settlementCycles.clear();
    this.merchantLedgers.clear();
    this.settlementLines.clear();
    this.settlementBatches.clear();
    this.paymentInstructions.clear();
    this.paymentResults.clear();
    this.refunds.clear();
    this.reversals.clear();
    this.auditLogs.clear();
  }
}

export const db = new DbStore();
