# Sharon Rewards Settlement Engine Backend

Production-quality backend for the Sharon Business / Future Rewards Settlement Engine.

## Critical Business Principle
> [!IMPORTANT]
> **Sharon is NOT a bank, wallet, payment aggregator, custodian, or holder of money.**
> Sharon MUST NEVER hold customer or merchant funds.
> Sharon is purely a technology, rewards, ledger, reconciliation, and settlement-instruction engine.
> Actual money movement happens directly between customer/merchant bank or UPI accounts through regulated payment rails.

---

## Key Features
- **Paise-Based Minor Unit Arithmetic**: All monetary values are represented as integer paise (`1 INR = 100 paise`). Zero floating-point calculations allowed.
- **Source-Level Reward Lot Traceability**: Every transaction creates a reward lot retaining the exact funding merchant ID.
- **FIFO Lot Consumption**: Redemptions consume available lots chronologically, preserving exact merchant funding contributions.
- **Voucher & UPI Payout Redemptions**: Supports both UPI/Bank Payouts via `PaymentProvider` abstraction and Network Vouchers redeemed at participating network merchants.
- **Proportional Merchant Obligation & Netting Engine**: Computes exact funding obligations per merchant and nets positions (`PAY` / `RECEIVE`).
- **Strict Network Isolation**: Multitenant isolation per network (e.g. `PALAKKAD-001`).
- **Mandatory Balance Verification**: Settlement batches will **NEVER** release unless `TOTAL PAYABLES == TOTAL RECEIVABLES`. If unbalanced, sets state `RECONCILIATION_FAILED`.
- **Idempotency & Audit Traceability**: Full idempotency key enforcement and immutable event logging.

---

## Directory Layout
```
/sharon-backend
  /src
    /common       # Money math (paise), errors, logger, idempotency, types
    /config       # Global runtime configuration
    /database     # PostgreSQL schema DDL & unified DB store
    /modules      # 11 modular domain services & controllers
    /jobs         # Weekly settlement scheduler, voucher expiry, payment poller
    /tests        # 18 automated integration test scenarios & seed runner
    app.ts        # Express REST API application
    server.ts     # Standalone server runner
  README.md
  ARCHITECTURE.md
  DATABASE.md
  SETTLEMENT_ENGINE.md
  API.md
  SECURITY.md
  PAYMENT_PROVIDER.md
  TESTING.md
  DEPLOYMENT.md
```

---

## Getting Started

### Run Automated Tests & Seed Data
```bash
cmd /c npx tsx sharon-backend/src/tests/run-tests.ts
```

### Start Local Server
```bash
cmd /c npx tsx sharon-backend/src/server.ts
```
Server runs at `http://localhost:3000/api`.
