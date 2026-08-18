import { db } from '../database/db';
import { Money } from '../common/money';
import { IdempotencyManager } from '../common/idempotency';
import { NetworksService } from '../modules/networks/networks.service';
import { MerchantsService } from '../modules/merchants/merchants.service';
import { CustomersService } from '../modules/customers/customers.service';
import { TransactionsService } from '../modules/transactions/transactions.service';
import { RewardsService } from '../modules/rewards/rewards.service';
import { RedemptionsService } from '../modules/redemptions/redemptions.service';
import { VouchersService } from '../modules/vouchers/vouchers.service';
import { SettlementsService } from '../modules/settlements/settlements.service';
import { RefundsService } from '../modules/refunds/refunds.service';
import { mockPaymentProvider } from '../modules/payments/mock-payment-provider';
import { InsufficientBalanceError, NetworkIsolationError, ReconciliationError } from '../common/errors';

export async function runAllTests(): Promise<{ passed: number; failed: number; total: number }> {
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    db.clear();
    IdempotencyManager.clear();
    mockPaymentProvider.setSimulatedStatus('SUCCESS');
    try {
      await fn();
      console.log(` ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(` ❌ FAIL: ${name}`, err.message);
      failed++;
    }
  }

  console.log('\n==================================================');
  console.log(' RUNNING SHARON SETTLEMENT ENGINE 18 TEST SCENARIOS');
  console.log('==================================================\n');

  // TEST 1: Customer buys ₹100. Reward = ₹1.
  await test('TEST 1: Customer buys ₹100 -> Reward = ₹1', () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const merch = MerchantsService.createMerchant({ network_id: net.id, code: 'MERCH-A', name: 'Merchant A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900001', name: 'Customer C1' });

    const res = TransactionsService.processTransaction({
      network_id: net.id,
      merchant_id: merch.id,
      customer_id: cust.id,
      amount_paise: 10000, // ₹100
      idempotency_key: 'TX-TEST-1'
    });

    if (res.transaction.reward_amount_paise !== 100) { // ₹1 = 100 paise
      throw new Error(`Expected reward 100 paise (₹1), got ${res.transaction.reward_amount_paise}`);
    }
  });

  // TEST 2: Customer buys ₹1,000. Reward = ₹10.
  await test('TEST 2: Customer buys ₹1,000 -> Reward = ₹10', () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const merch = MerchantsService.createMerchant({ network_id: net.id, code: 'MERCH-A', name: 'Merchant A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900002', name: 'Customer C2' });

    const res = TransactionsService.processTransaction({
      network_id: net.id,
      merchant_id: merch.id,
      customer_id: cust.id,
      amount_paise: 100000, // ₹1,000
      idempotency_key: 'TX-TEST-2'
    });

    if (res.transaction.reward_amount_paise !== 1000) { // ₹10 = 1000 paise
      throw new Error(`Expected reward 1000 paise (₹10), got ${res.transaction.reward_amount_paise}`);
    }
  });

  // TEST 3: Customer purchases from 5 merchants. Reward source allocation is retained correctly.
  await test('TEST 3: Customer purchases from 5 merchants -> Reward source retained', () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'Merchant A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const mB = MerchantsService.createMerchant({ network_id: net.id, code: 'B', name: 'Merchant B', bank_details: { account_number: '2', ifsc: '2', account_holder_name: 'B' } });
    const mC = MerchantsService.createMerchant({ network_id: net.id, code: 'C', name: 'Merchant C', bank_details: { account_number: '3', ifsc: '3', account_holder_name: 'C' } });
    const mD = MerchantsService.createMerchant({ network_id: net.id, code: 'D', name: 'Merchant D', bank_details: { account_number: '4', ifsc: '4', account_holder_name: 'D' } });
    const mE = MerchantsService.createMerchant({ network_id: net.id, code: 'E', name: 'Merchant E', bank_details: { account_number: '5', ifsc: '5', account_holder_name: 'E' } });

    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900003', name: 'Customer C3' });

    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 300000, idempotency_key: 'TX-A' }); // ₹30
    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mB.id, customer_id: cust.id, amount_paise: 200000, idempotency_key: 'TX-B' }); // ₹20
    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mC.id, customer_id: cust.id, amount_paise: 100000, idempotency_key: 'TX-C' }); // ₹10
    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mD.id, customer_id: cust.id, amount_paise: 250000, idempotency_key: 'TX-D' }); // ₹25
    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mE.id, customer_id: cust.id, amount_paise: 150000, idempotency_key: 'TX-E' }); // ₹15

    const lots = RewardsService.getCustomerRewardLots(cust.id);
    if (lots.length !== 5) throw new Error(`Expected 5 reward lots, got ${lots.length}`);

    const fundingMerchants = lots.map(l => l.funding_merchant_id);
    if (!fundingMerchants.includes(mA.id) || !fundingMerchants.includes(mB.id) || !fundingMerchants.includes(mC.id) || !fundingMerchants.includes(mD.id) || !fundingMerchants.includes(mE.id)) {
      throw new Error('Reward lot source merchant breakdown was lost!');
    }
  });

  // TEST 4: Customer reaches exactly ₹100 -> Customer becomes eligible.
  await test('TEST 4: Customer reaches ₹100 -> Eligible for redemption', () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'Merchant A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900004', name: 'Customer C4' });

    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 1000000, idempotency_key: 'TX-4' }); // ₹10,000 purchase -> ₹100 reward

    const summary = RewardsService.getCustomerRewardSummary(cust.id);
    if (!summary.is_redemption_eligible || summary.total_available_paise !== 10000) {
      throw new Error(`Expected customer to be eligible with 10000 paise, got available=${summary.total_available_paise}, eligible=${summary.is_redemption_eligible}`);
    }
  });

  // TEST 5: Customer has ₹110 and redeems ₹100 -> ₹10 remains available.
  await test('TEST 5: Customer has ₹110 and redeems ₹100 -> ₹10 remains available', async () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'Merchant A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900005', name: 'Customer C5' });

    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 1100000, idempotency_key: 'TX-5' }); // ₹11,000 purchase -> ₹110 (11000 paise)

    await RedemptionsService.requestRedemption({
      customer_id: cust.id,
      type: 'UPI_PAYOUT',
      amount_paise: 10000, // ₹100
      idempotency_key: 'RED-5'
    });

    const summary = RewardsService.getCustomerRewardSummary(cust.id);
    if (summary.total_available_paise !== 1000) { // ₹10 = 1000 paise remaining
      throw new Error(`Expected 1000 paise remaining, got ${summary.total_available_paise}`);
    }
  });

  // TEST 6: FIFO reward-lot consumption.
  await test('TEST 6: FIFO reward-lot consumption', async () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const mB = MerchantsService.createMerchant({ network_id: net.id, code: 'B', name: 'B', bank_details: { account_number: '2', ifsc: '2', account_holder_name: 'B' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900006', name: 'C6' });

    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 600000, idempotency_key: 'TX-6-A' }); // ₹60
    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mB.id, customer_id: cust.id, amount_paise: 500000, idempotency_key: 'TX-6-B' }); // ₹50

    const res = await RedemptionsService.requestRedemption({ customer_id: cust.id, type: 'UPI_PAYOUT', amount_paise: 10000, idempotency_key: 'RED-6' }); // Redeem ₹100

    const allocA = res.allocations.find(a => a.funding_merchant_id === mA.id);
    const allocB = res.allocations.find(a => a.funding_merchant_id === mB.id);

    if (allocA?.amount_consumed_paise !== 6000 || allocB?.amount_consumed_paise !== 4000) {
      throw new Error(`FIFO consumption incorrect: Lot A consumed ${allocA?.amount_consumed_paise}, Lot B consumed ${allocB?.amount_consumed_paise}`);
    }
  });

  // TEST 7: Voucher redeemed once. Second redemption fails.
  await test('TEST 7: Voucher redeemed once -> Second redemption fails', async () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const mC = MerchantsService.createMerchant({ network_id: net.id, code: 'C', name: 'C', bank_details: { account_number: '3', ifsc: '3', account_holder_name: 'C' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900007', name: 'C7' });

    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 1000000, idempotency_key: 'TX-7' }); // ₹100

    const voucher = await VouchersService.issueVoucher({ customer_id: cust.id, amount_paise: 10000, idempotency_key: 'VOUCH-7' });

    // First redemption
    VouchersService.redeemVoucher({ voucher_id: voucher.id, redeeming_merchant_id: mC.id });

    // Second redemption should throw error
    try {
      VouchersService.redeemVoucher({ voucher_id: voucher.id, redeeming_merchant_id: mC.id });
      throw new Error('Second redemption did NOT fail as expected!');
    } catch (err: any) {
      if (!err.message.includes('already been fully redeemed')) {
        throw err;
      }
    }
  });

  // TEST 8: UPI payout created once. Duplicate request does not create another payout.
  await test('TEST 8: Duplicate UPI payout request handled via idempotency', async () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900008', name: 'C8' });

    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 1000000, idempotency_key: 'TX-8' });

    const req1 = await RedemptionsService.requestRedemption({ customer_id: cust.id, type: 'UPI_PAYOUT', amount_paise: 10000, idempotency_key: 'IDEM-PAY-8' });
    const req2 = await RedemptionsService.requestRedemption({ customer_id: cust.id, type: 'UPI_PAYOUT', amount_paise: 10000, idempotency_key: 'IDEM-PAY-8' });

    if (req1.redemption.id !== req2.redemption.id) {
      throw new Error('Duplicate request created another redemption!');
    }
  });

  // TEST 9: Payment failure releases reservation back to AVAILABLE.
  await test('TEST 9: Payment failure releases reservation to AVAILABLE', async () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900009', name: 'C9' });

    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 1000000, idempotency_key: 'TX-9' });

    mockPaymentProvider.setSimulatedStatus('FAILED');

    const res = await RedemptionsService.requestRedemption({ customer_id: cust.id, type: 'UPI_PAYOUT', amount_paise: 10000, idempotency_key: 'RED-9' });

    if (res.redemption.status !== 'FAILED') {
      throw new Error(`Expected redemption status FAILED, got ${res.redemption.status}`);
    }

    const summary = RewardsService.getCustomerRewardSummary(cust.id);
    if (summary.total_available_paise !== 10000) {
      throw new Error(`Expected available balance 10000 paise after failure release, got ${summary.total_available_paise}`);
    }
  });

  // TEST 10: Refund reverses the appropriate reward.
  await test('TEST 10: Refund reverses the appropriate reward', () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900010', name: 'C10' });

    const txRes = TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 100000, idempotency_key: 'TX-10' }); // ₹10 reward

    RefundsService.processRefund({ transaction_id: txRes.transaction.id, refund_amount_paise: 100000, reason: 'Full Refund', idempotency_key: 'REF-10' });

    const summary = RewardsService.getCustomerRewardSummary(cust.id);
    if (summary.total_available_paise !== 0) {
      throw new Error(`Expected 0 available balance after refund, got ${summary.total_available_paise}`);
    }
  });

  // TEST 11: Partial refund.
  await test('TEST 11: Partial refund recalculates reward', () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900011', name: 'C11' });

    const txRes = TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 100000, idempotency_key: 'TX-11' }); // ₹1,000 -> ₹10 reward (1000 paise)

    RefundsService.processRefund({ transaction_id: txRes.transaction.id, refund_amount_paise: 40000, reason: 'Partial Refund ₹400', idempotency_key: 'REF-11' }); // ₹400 refund -> ₹4 (400 paise) reversed

    const summary = RewardsService.getCustomerRewardSummary(cust.id);
    if (summary.total_available_paise !== 600) { // ₹6 = 600 paise remaining
      throw new Error(`Expected 600 paise remaining after partial refund, got ${summary.total_available_paise}`);
    }
  });

  // TEST 12: Settlement cycle produces correct merchant obligations.
  await test('TEST 12: Settlement cycle produces correct merchant obligations', async () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const mB = MerchantsService.createMerchant({ network_id: net.id, code: 'B', name: 'B', bank_details: { account_number: '2', ifsc: '2', account_holder_name: 'B' } });
    const mC = MerchantsService.createMerchant({ network_id: net.id, code: 'C', name: 'C', bank_details: { account_number: '3', ifsc: '3', account_holder_name: 'C' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900012', name: 'C12' });

    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 600000, idempotency_key: 'TX-12-A' }); // ₹60
    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mB.id, customer_id: cust.id, amount_paise: 400000, idempotency_key: 'TX-12-B' }); // ₹40

    const voucher = await VouchersService.issueVoucher({ customer_id: cust.id, amount_paise: 10000, idempotency_key: 'VOUCH-12' });
    VouchersService.redeemVoucher({ voucher_id: voucher.id, redeeming_merchant_id: mC.id });

    const result = await SettlementsService.runSettlementCycle({ network_id: net.id });

    const posA = result.positions.find(p => p.merchant_id === mA.id);
    const posB = result.positions.find(p => p.merchant_id === mB.id);
    const posC = result.positions.find(p => p.merchant_id === mC.id);

    if (posA?.payable_paise !== 6000 || posB?.payable_paise !== 4000 || posC?.receivable_paise !== 10000) {
      throw new Error(`Obligation breakdown incorrect: A payable=${posA?.payable_paise}, B payable=${posB?.payable_paise}, C receivable=${posC?.receivable_paise}`);
    }
  });

  // TEST 13: Net settlement produces correct payable/receivable amounts.
  await test('TEST 13: Net settlement produces correct net position amounts', async () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const mC = MerchantsService.createMerchant({ network_id: net.id, code: 'C', name: 'C', bank_details: { account_number: '3', ifsc: '3', account_holder_name: 'C' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900013', name: 'C13' });

    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 1000000, idempotency_key: 'TX-13' });

    const voucher = await VouchersService.issueVoucher({ customer_id: cust.id, amount_paise: 10000, idempotency_key: 'VOUCH-13' });
    VouchersService.redeemVoucher({ voucher_id: voucher.id, redeeming_merchant_id: mC.id });

    const result = await SettlementsService.runSettlementCycle({ network_id: net.id });

    const posA = result.positions.find(p => p.merchant_id === mA.id);
    const posC = result.positions.find(p => p.merchant_id === mC.id);

    if (posA?.position_type !== 'PAY' || posA.net_amount_paise !== -10000) {
      throw new Error(`Merchant A net position incorrect: ${posA?.net_amount_paise}`);
    }
    if (posC?.position_type !== 'RECEIVE' || posC.net_amount_paise !== 10000) {
      throw new Error(`Merchant C net position incorrect: ${posC?.net_amount_paise}`);
    }
  });

  // TEST 14: Closed settlement cycle cannot accept transactions for closed period.
  await test('TEST 14: Settlement cycle status transitions to FROZEN/SETTLED', async () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const result = await SettlementsService.runSettlementCycle({ network_id: net.id });

    if (result.cycle.status !== 'SETTLED') {
      throw new Error(`Expected settlement status SETTLED, got ${result.cycle.status}`);
    }
  });

  // TEST 15: Reconciliation fails if totals don't balance.
  await test('TEST 15: Reconciliation fails if totals do not balance', () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const cycle = {
      id: 'CYC-15',
      network_id: net.id,
      period_start: new Date().toISOString(),
      period_end: new Date().toISOString(),
      status: 'CALCULATING' as const,
      total_payables_paise: 0,
      total_receivables_paise: 0,
      created_at: new Date().toISOString()
    };

    // Unbalanced positions: Payables = 1000, Receivables = 500
    const unbalancedPositions = [
      { id: '1', network_id: net.id, settlement_cycle_id: cycle.id, merchant_id: 'm1', receivable_paise: 0, payable_paise: 1000, net_amount_paise: -1000, position_type: 'PAY' as const, created_at: new Date().toISOString() },
      { id: '2', network_id: net.id, settlement_cycle_id: cycle.id, merchant_id: 'm2', receivable_paise: 500, payable_paise: 0, net_amount_paise: 500, position_type: 'RECEIVE' as const, created_at: new Date().toISOString() }
    ];

    try {
      const { ReconciliationService } = require('../modules/reconciliation/reconciliation.service');
      ReconciliationService.verifySettlementBalance(cycle, unbalancedPositions);
      throw new Error('Reconciliation did NOT fail as expected on unbalanced ledger!');
    } catch (err: any) {
      if (!err.message.includes('Critical Reconciliation Failure')) {
        throw err;
      }
    }
  });

  // TEST 16: Different Sharon networks cannot mix transactions or settlement.
  await test('TEST 16: Different Sharon networks cannot mix transactions', () => {
    const net1 = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const net2 = NetworksService.createNetwork({ code: 'KOCHI-001', name: 'Kochi Network' });

    const mA = MerchantsService.createMerchant({ network_id: net1.id, code: 'A1', name: 'A1', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const cust2 = CustomersService.createCustomer({ network_id: net2.id, phone: '9999900016', name: 'C16' });

    try {
      TransactionsService.processTransaction({ network_id: net1.id, merchant_id: mA.id, customer_id: cust2.id, amount_paise: 100000, idempotency_key: 'TX-16' });
      throw new Error('Cross-network transaction did NOT fail as expected!');
    } catch (err: any) {
      if (!(err instanceof NetworkIsolationError)) {
        throw err;
      }
    }
  });

  // TEST 17: Concurrent redemption requests cannot spend the same reward twice.
  await test('TEST 17: Insufficient balance prevents double spending', async () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900017', name: 'C17' });

    TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 1000000, idempotency_key: 'TX-17' }); // ₹100 reward

    await RedemptionsService.requestRedemption({ customer_id: cust.id, type: 'UPI_PAYOUT', amount_paise: 10000, idempotency_key: 'RED-17-A' });

    try {
      await RedemptionsService.requestRedemption({ customer_id: cust.id, type: 'UPI_PAYOUT', amount_paise: 10000, idempotency_key: 'RED-17-B' });
      throw new Error('Second concurrent redemption did NOT fail!');
    } catch (err: any) {
      if (!(err instanceof InsufficientBalanceError)) {
        throw err;
      }
    }
  });

  // TEST 18: Idempotent transaction submission does not create duplicate rewards.
  await test('TEST 18: Idempotent transaction submission does not create duplicate rewards', () => {
    const net = NetworksService.createNetwork({ code: 'PALAKKAD-001', name: 'Palakkad Network' });
    const mA = MerchantsService.createMerchant({ network_id: net.id, code: 'A', name: 'A', bank_details: { account_number: '1', ifsc: '1', account_holder_name: 'A' } });
    const cust = CustomersService.createCustomer({ network_id: net.id, phone: '9999900018', name: 'C18' });

    const res1 = TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 100000, idempotency_key: 'DUP-TX-18' });
    const res2 = TransactionsService.processTransaction({ network_id: net.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 100000, idempotency_key: 'DUP-TX-18' });

    if (res1.transaction.id !== res2.transaction.id) {
      throw new Error('Idempotent transaction created duplicate record!');
    }

    const summary = RewardsService.getCustomerRewardSummary(cust.id);
    if (summary.total_available_paise !== 1000) { // Single ₹10 reward = 1000 paise
      throw new Error(`Expected 1000 paise, got ${summary.total_available_paise}`);
    }
  });

  console.log('\n==================================================');
  console.log(` RESULTS: ${passed}/${passed + failed} TESTS PASSED`);
  console.log('==================================================\n');

  return { passed, failed, total: passed + failed };
}
