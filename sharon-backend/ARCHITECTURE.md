# System Architecture - Sharon Settlement Engine

## Architecture Paradigm: Modular Monolith

Sharon is designed as a clean **Modular Monolith** in TypeScript to ensure low latency, transaction integrity, and auditability without microservice operational complexity for V1.

```mermaid
flowchart TD
    Client[Customer / Merchant / Web App] -->|HTTP REST| API[Express REST API / Router]
    
    subgraph Core Modules
        API --> Tx[Transactions Module]
        API --> Rewards[Rewards Engine]
        API --> Redemptions[Redemptions Module]
        API --> Vouchers[Vouchers Module]
        API --> Settlements[Settlement & Netting Engine]
        API --> Payments[Payment Provider Adapter]
    end

    subgraph Data & Ledger
        Tx --> Lots[(Reward Lots)]
        Rewards --> Ledger[(Immutable Reward Ledger)]
        Redemptions --> Allocations[(Redemption Allocations)]
        Settlements --> NetMatrix[(Merchant Net Positions)]
        Payments --> Instructions[(Payment Instructions)]
    end

    Settlements -->|Reconciliation Check| Reco{TOTAL PAYABLES == TOTAL RECEIVABLES?}
    Reco -->|YES| Batch[Release Settlement Batch]
    Reco -->|NO| Fail[Mark RECONCILIATION_FAILED & Freeze Batch]

    Batch --> Provider[Regulated Payment Provider / Bank]
```

## Architectural Distinction Table

| Concept | Explanation | Real Money Movement? |
| :--- | :--- | :--- |
| **Reward Entitlement** | Customer's record of unredeemed reward value earned. | ❌ No |
| **Merchant Funding Obligation** | Accounting obligation owed by merchant who generated the reward. | ❌ No |
| **Merchant Receivable** | Credit owed to merchant who provided benefit to customer. | ❌ No |
| **Settlement Instruction** | Audited netting instruction emitted by Sharon engine. | ❌ No |
| **Actual Money Movement** | Direct bank/UPI transfer between merchant/customer accounts via regulated payment rails. | ✅ Yes (Handled by Provider) |
