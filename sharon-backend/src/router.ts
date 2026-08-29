import { Router } from 'express';
import { NetworksController } from './modules/networks/networks.controller';
import { MerchantsController } from './modules/merchants/merchants.controller';
import { CustomersController } from './modules/customers/customers.controller';
import { TransactionsController } from './modules/transactions/transactions.controller';
import { RewardsController } from './modules/rewards/rewards.controller';
import { RedemptionsController } from './modules/redemptions/redemptions.controller';
import { VouchersController } from './modules/vouchers/vouchers.controller';
import { SettlementsController } from './modules/settlements/settlements.controller';
import { PaymentsController } from './modules/payments/payments.controller';
import { ReconciliationController } from './modules/reconciliation/reconciliation.controller';
import { AuditController } from './modules/audit/audit.controller';
import { RefundsController } from './modules/refunds/refunds.controller';

export const sharonRouter = Router();

// Networks
sharonRouter.post('/networks', NetworksController.create);
sharonRouter.get('/networks', NetworksController.list);
sharonRouter.get('/networks/:id', NetworksController.get);

// Merchants
sharonRouter.post('/merchants', MerchantsController.create);
sharonRouter.get('/merchants', MerchantsController.list);
sharonRouter.get('/merchants/:id', MerchantsController.get);
sharonRouter.patch('/merchants/:id/status', MerchantsController.updateStatus);
sharonRouter.post('/merchants/:id/subscription', MerchantsController.purchaseSubscription);
sharonRouter.post('/merchants/:id/top-up', MerchantsController.topUpPoints);

// Customers
sharonRouter.post('/customers', CustomersController.create);
sharonRouter.get('/customers', CustomersController.list);
sharonRouter.get('/customers/:id', CustomersController.get);

// Transactions
sharonRouter.post('/transactions', TransactionsController.create);
sharonRouter.get('/transactions/:id', TransactionsController.get);

// Customer Rewards
sharonRouter.get('/customers/:id/rewards', RewardsController.getCustomerRewards);
sharonRouter.get('/customers/:id/reward-lots', RewardsController.getCustomerLots);

// Redemptions
sharonRouter.post('/redemptions', RedemptionsController.create);
sharonRouter.get('/redemptions/:id', RedemptionsController.get);

// Vouchers
sharonRouter.post('/vouchers', VouchersController.issue);
sharonRouter.get('/vouchers/:id', VouchersController.get);
sharonRouter.post('/vouchers/:id/redeem', VouchersController.redeem);

// Settlements
sharonRouter.post('/settlements/run', SettlementsController.run);
sharonRouter.get('/settlements/:id', SettlementsController.get);
sharonRouter.get('/merchants/:id/settlement-position', SettlementsController.getMerchantPosition);

// Reconciliation
sharonRouter.get('/networks/:id/reconciliation', ReconciliationController.getStatus);

// Payments & Callbacks
sharonRouter.post('/payment-callbacks', PaymentsController.handleCallback);
sharonRouter.get('/payments/instructions/:id', PaymentsController.getInstruction);
sharonRouter.post('/payments/create-subscription', PaymentsController.createSubscription);

// Refunds
sharonRouter.post('/refunds', RefundsController.create);

// Audit Log History
sharonRouter.get('/audit/:entity/:id', AuditController.getHistory);
