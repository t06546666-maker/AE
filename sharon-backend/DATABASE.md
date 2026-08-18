# Database & Schema Design - Sharon Settlement Engine

## Database Overview
- **Engine**: PostgreSQL 14+
- **Primary Keys**: UUID v4
- **Monetary Storage**: BIGINT representing integer paise (INR). No `FLOAT` or `DECIMAL` allowed!

## ER Diagram (Core Entities)

```mermaid
erDiagram
    NETWORKS ||--o{ MERCHANTS : contains
    NETWORKS ||--o{ CUSTOMERS : contains
    MERCHANTS ||--o{ TRANSACTIONS : generates
    CUSTOMERS ||--o{ TRANSACTIONS : places
    TRANSACTIONS ||--o{ REWARD_LOTS : creates
    CUSTOMERS ||--o{ REDEMPTIONS : requests
    REDEMPTIONS ||--o{ REDEMPTION_ALLOCATIONS : allocates
    REWARD_LOTS ||--o{ REDEMPTION_ALLOCATIONS : consumes
    NETWORKS ||--o{ SETTLEMENT_CYCLES : runs
    SETTLEMENT_CYCLES ||--o{ MERCHANT_LEDGER : nets
    REDEMPTIONS ||--o? VOUCHERS : issues
```

## Schema Files
- SQL DDL File: [`src/database/schema.sql`](file:///c:/Users/91730/Downloads/affiliate-ae-whatsapp-ordering-update/sharon-backend/src/database/schema.sql)
