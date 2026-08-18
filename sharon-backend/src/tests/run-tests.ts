import { runAllTests } from './suite.test';
import { db } from '../database/db';
import { NetworksService } from '../modules/networks/networks.service';
import { MerchantsService } from '../modules/merchants/merchants.service';
import { CustomersService } from '../modules/customers/customers.service';
import { TransactionsService } from '../modules/transactions/transactions.service';
import { VouchersService } from '../modules/vouchers/vouchers.service';
import { SettlementsService } from '../modules/settlements/settlements.service';
import { Money } from '../common/money';

async function main() {
  console.log('🚀 Running Sharon Rewards Settlement Engine Test Suite...');
  
  // 1. Execute all 18 Unit & Business Logic Tests
  const results = await runAllTests();

  if (results.failed > 0) {
    console.error(`💥 ${results.failed} tests failed!`);
    process.exit(1);
  }

  // 2. Setup Specification Development Seed Data (PALAKKAD-001)
  console.log('\n==================================================');
  console.log(' INITIALIZING SEED DATA FOR PALAKKAD-001 NETWORK');
  console.log('==================================================\n');

  db.clear();

  const network = NetworksService.createNetwork({
    code: 'PALAKKAD-001',
    name: 'Palakkad Network',
    reward_rate_bps: 100, // 1%
    min_redemption_threshold_paise: 10000 // ₹100
  });

  const mA = MerchantsService.createMerchant({ network_id: network.id, code: 'A', name: 'Merchant A', bank_details: { account_number: '1001', ifsc: 'SBIN0001', account_holder_name: 'Merchant A' } });
  const mB = MerchantsService.createMerchant({ network_id: network.id, code: 'B', name: 'Merchant B', bank_details: { account_number: '1002', ifsc: 'SBIN0001', account_holder_name: 'Merchant B' } });
  const mC = MerchantsService.createMerchant({ network_id: network.id, code: 'C', name: 'Merchant C', bank_details: { account_number: '1003', ifsc: 'SBIN0001', account_holder_name: 'Merchant C' } });
  const mD = MerchantsService.createMerchant({ network_id: network.id, code: 'D', name: 'Merchant D', bank_details: { account_number: '1004', ifsc: 'SBIN0001', account_holder_name: 'Merchant D' } });
  const mE = MerchantsService.createMerchant({ network_id: network.id, code: 'E', name: 'Merchant E', bank_details: { account_number: '1005', ifsc: 'SBIN0001', account_holder_name: 'Merchant E' } });

  const cust = CustomersService.createCustomer({
    id: 'C001',
    network_id: network.id,
    phone: '9876543210',
    name: 'Customer C001',
    upi_id: 'c001@upi'
  });

  console.log(`Created Network: ${network.code}`);
  console.log(`Created 5 Merchants: A, B, C, D, E`);
  console.log(`Created Customer: ${cust.id} (${cust.name})`);

  // Transactions: A = ₹3,000; B = ₹2,000; C = ₹1,000; D = ₹2,500; E = ₹1,500
  TransactionsService.processTransaction({ network_id: network.id, merchant_id: mA.id, customer_id: cust.id, amount_paise: 300000, idempotency_key: 'SEED-TX-A' });
  TransactionsService.processTransaction({ network_id: network.id, merchant_id: mB.id, customer_id: cust.id, amount_paise: 200000, idempotency_key: 'SEED-TX-B' });
  TransactionsService.processTransaction({ network_id: network.id, merchant_id: mC.id, customer_id: cust.id, amount_paise: 100000, idempotency_key: 'SEED-TX-C' });
  TransactionsService.processTransaction({ network_id: network.id, merchant_id: mD.id, customer_id: cust.id, amount_paise: 250000, idempotency_key: 'SEED-TX-D' });
  TransactionsService.processTransaction({ network_id: network.id, merchant_id: mE.id, customer_id: cust.id, amount_paise: 150000, idempotency_key: 'SEED-TX-E' });

  console.log('\nGenerated Rewards:');
  console.log(`  Merchant A (₹3,000 @ 1%) => ₹30 (3000 paise)`);
  console.log(`  Merchant B (₹2,000 @ 1%) => ₹20 (2000 paise)`);
  console.log(`  Merchant C (₹1,000 @ 1%) => ₹10 (1000 paise)`);
  console.log(`  Merchant D (₹2,500 @ 1%) => ₹25 (2500 paise)`);
  console.log(`  Merchant E (₹1,500 @ 1%) => ₹15 (1500 paise)`);
  console.log(`  -----------------------------------------`);
  console.log(`  Total Entitlement         => ₹100 (10000 paise)`);

  // Redeem ₹100 Voucher at Merchant C
  const voucher = await VouchersService.issueVoucher({
    customer_id: cust.id,
    amount_paise: 10000,
    idempotency_key: 'SEED-VOUCHER-001'
  });

  console.log(`\nIssued Voucher Code: ${voucher.code}`);

  VouchersService.redeemVoucher({
    voucher_id: voucher.id,
    redeeming_merchant_id: mC.id
  });

  console.log(`Voucher Redeemed at Merchant C.`);

  // Execute Settlement Cycle & Verify Net Positions
  const settlementResult = await SettlementsService.runSettlementCycle({ network_id: network.id });

  console.log('\n==================================================');
  console.log(' SETTLEMENT CYCLE RESULTS FOR PALAKKAD-001');
  console.log('==================================================\n');

  console.log(`Cycle ID    : ${settlementResult.cycle.id}`);
  console.log(`Status      : ${settlementResult.cycle.status}`);
  console.log(`Reconciled  : TOTAL PAYABLES (${Money.format(settlementResult.cycle.total_payables_paise)}) == TOTAL RECEIVABLES (${Money.format(settlementResult.cycle.total_receivables_paise)})\n`);

  console.log('Merchant Net Positions:');
  for (const pos of settlementResult.positions) {
    const merchant = db.merchants.get(pos.merchant_id);
    console.log(`  Merchant ${merchant?.code.padEnd(2)} | Payable: ${Money.format(pos.payable_paise).padEnd(8)} | Receivable: ${Money.format(pos.receivable_paise).padEnd(8)} | Net: ${pos.position_type} ${Money.format(Math.abs(pos.net_amount_paise))}`);
  }

  console.log('\n🎉 Sharon Rewards Settlement Engine Seed & Test Suite execution completed successfully!\n');
}

main().catch(err => {
  console.error('Fatal error during test runner:', err);
  process.exit(1);
});
