# Atomic points update

Desired rules: issuing E points reduces the merchant allocation by E and increases customer global/store balances by E. Redeeming R reduces only customer global/store balances by R. A combined purchase applies +E-R to the customer and -E to the merchant. Redemption never refunds allocation.

Code is gated by ATOMIC_POINTS_ENABLED=true. Before enabling, apply supabase-atomic-points.sql after merchant allocation, loyalty, rewards engine/expiry migrations. Verify the schema, network IDs, existing triggers and balances on staging first. Migration preserves historical balances; it does not repair historic mismatches. Legacy balances without reward lots remain redeemable; available matching lots are consumed first.

New transaction RPC locks the customer, records request keys and arguments, updates order/redemption records and balances, and records reward lots/ledger events in one database transaction. The existing named merchant-debit trigger is recreated to debit issuance once; unknown additional triggers must be audited before activation. Loyalty bonus issuance uses the same merchant debit trigger. Expiry uses a matching customer lock and exact decimal deductions. Missing RPC fails without falling back when enabled.

Acceptance tests on an isolated database:
- Merchant 500/customer 200: issue 15 -> merchant 485/customer 215.
- Redeem 100 alone -> merchant unchanged/customer -100.
- Combined issue 15/redeem 100 -> merchant -15/customer -85.
- Repeat same request key and same arguments -> same result/no extra change.
- Same request key/different arguments -> rejected.
- Insufficient merchant allocation/customer balance -> whole transaction rolls back.
- Concurrent issuance/redemption/expiry -> no lost balance updates or negative balances.
- Reward lot consumption followed by expiry does not deduct redeemed points again.
- Registration with zero amount/rate -> zero earned points.
- Loyalty bonus -> merchant deduction equals customer increase.

Local checks cannot certify SQL runtime correctness. No live database migration, balance adjustment, or environment activation performed yet. Other affiliate settlement/refund routes are separate and require a live schema/workflow audit before claiming every historical balance is reconciled.
