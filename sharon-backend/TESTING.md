# Testing Strategy & Automated Test Suite

## Overview
Sharon includes an automated test suite verifying all 18 business rules specified in the core prompt.

## Execution Command
```bash
cmd /c npx tsx sharon-backend/src/tests/run-tests.ts
```

## Summary of 18 Automated Test Scenarios
1. Customer buys ₹100 -> Reward = ₹1 (100 paise).
2. Customer buys ₹1,000 -> Reward = ₹10 (1000 paise).
3. Customer purchases from 5 merchants -> Source-level funding merchant allocation retained.
4. Customer reaches ₹100 -> Eligible for redemption.
5. Customer has ₹110 and redeems ₹100 -> ₹10 remains available.
6. FIFO reward-lot consumption order.
7. Single-use voucher redemption -> Second redemption attempt fails.
8. Duplicate UPI payout request -> Handled via idempotency.
9. Payment failure -> Reservation released back to AVAILABLE.
10. Transaction refund -> Reverses unredeemed reward lot.
11. Partial refund recalculation.
12. Settlement cycle -> Produces exact merchant funding obligations.
13. Net settlement -> Produces correct net payables/receivables per merchant.
14. Closed settlement cycle -> Transitions status cleanly.
15. Unbalanced settlement -> Reconciliation fails and blocks batch release.
16. Network isolation -> Prevents cross-network transaction mixing.
17. Concurrent redemptions -> Insufficient balance prevents double spending.
18. Idempotent transaction submission -> Replaying request returns identical response without duplicate reward creation.
