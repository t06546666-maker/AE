-- ============================================================================
-- Sharon Rewards Settlement Engine - PostgreSQL DDL Schema
-- Production Database Design
-- All financial amounts are stored as BIGINT representing integer paise (INR).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. NETWORKS
CREATE TABLE IF NOT EXISTS networks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    reward_rate_bps INT NOT NULL DEFAULT 100, -- 1% = 100 bps
    min_redemption_threshold_paise BIGINT NOT NULL DEFAULT 10000, -- ₹100 = 10000 paise
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. MERCHANTS
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, SUSPENDED
    bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    reward_rate_bps INT NULL, -- Optional merchant override rate
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_merchant_network_code UNIQUE (network_id, code)
);

-- 3. MERCHANT USERS
CREATE TABLE IF NOT EXISTS merchant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(30) NOT NULL DEFAULT 'MERCHANT_STAFF',
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    upi_id VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_customer_network_phone UNIQUE (network_id, phone)
);

-- 5. TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    reward_amount_paise BIGINT NOT NULL CHECK (reward_amount_paise >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. REWARD RULES
CREATE TABLE IF NOT EXISTS reward_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    merchant_id UUID NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    reward_rate_bps INT NOT NULL CHECK (reward_rate_bps >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. REWARD LOTS
CREATE TABLE IF NOT EXISTS reward_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    funding_merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    initial_amount_paise BIGINT NOT NULL CHECK (initial_amount_paise >= 0),
    available_amount_paise BIGINT NOT NULL CHECK (available_amount_paise >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, RESERVED, EXHAUSTED, REVERSED
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. REWARD LEDGER (IMMUTABLE EVENT LOG)
CREATE TABLE IF NOT EXISTS reward_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    customer_id UUID NULL REFERENCES customers(id) ON DELETE RESTRICT,
    merchant_id UUID NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    transaction_id UUID NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    amount_paise BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    event_type VARCHAR(50) NOT NULL, -- REWARD_EARNED, REWARD_REVERSED, REWARD_RESERVED, REWARD_RELEASED, REWARD_REDEEMED, REFUND, SETTLEMENT_CREATED, SETTLEMENT_PAID, SETTLEMENT_FAILED
    reference_id VARCHAR(100) NULL,
    metadata JSONB NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_reward_ledger_idempotency UNIQUE (idempotency_key)
);

-- 9. REDEMPTIONS
CREATE TABLE IF NOT EXISTS redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    type VARCHAR(30) NOT NULL, -- UPI_PAYOUT, NETWORK_VOUCHER
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED', -- REQUESTED, RESERVED, PROCESSING, COMPLETED, FAILED, CANCELLED
    redeeming_merchant_id UUID NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    payout_instruction_id UUID NULL,
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. REDEMPTION ALLOCATIONS (FIFO CONSUMPTION TRACKING)
CREATE TABLE IF NOT EXISTS redemption_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    redemption_id UUID NOT NULL REFERENCES redemptions(id) ON DELETE CASCADE,
    reward_lot_id UUID NOT NULL REFERENCES reward_lots(id) ON DELETE RESTRICT,
    funding_merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    amount_consumed_paise BIGINT NOT NULL CHECK (amount_consumed_paise > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. VOUCHERS
CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    redemption_id UUID NOT NULL REFERENCES redemptions(id) ON DELETE RESTRICT,
    code VARCHAR(50) UNIQUE NOT NULL,
    original_value_paise BIGINT NOT NULL CHECK (original_value_paise > 0),
    remaining_value_paise BIGINT NOT NULL CHECK (remaining_value_paise >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'ISSUED', -- ISSUED, PARTIALLY_REDEEMED, FULLY_REDEEMED, EXPIRED, CANCELLED
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    redeemed_at TIMESTAMPTZ NULL,
    redeeming_merchant_id UUID NULL REFERENCES merchants(id) ON DELETE RESTRICT
);

-- 12. VOUCHER REDEMPTIONS
CREATE TABLE IF NOT EXISTS voucher_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
    redeeming_merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    amount_redeemed_paise BIGINT NOT NULL CHECK (amount_redeemed_paise > 0),
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. SETTLEMENT CYCLES
CREATE TABLE IF NOT EXISTS settlement_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN', -- OPEN, FROZEN, CALCULATING, RECONCILED, RECONCILIATION_FAILED, BATCH_GENERATED, SETTLED, EXCEPTION
    total_payables_paise BIGINT NOT NULL DEFAULT 0,
    total_receivables_paise BIGINT NOT NULL DEFAULT 0,
    reconciled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. MERCHANT LEDGER (SETTLEMENT POSITIONS)
CREATE TABLE IF NOT EXISTS merchant_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    settlement_cycle_id UUID NOT NULL REFERENCES settlement_cycles(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    receivable_paise BIGINT NOT NULL DEFAULT 0,
    payable_paise BIGINT NOT NULL DEFAULT 0,
    net_amount_paise BIGINT NOT NULL DEFAULT 0,
    position_type VARCHAR(20) NOT NULL, -- PAY, RECEIVE, BALANCED
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_merchant_settlement_cycle UNIQUE (settlement_cycle_id, merchant_id)
);

-- 15. SETTLEMENT LINES
CREATE TABLE IF NOT EXISTS settlement_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_cycle_id UUID NOT NULL REFERENCES settlement_cycles(id) ON DELETE CASCADE,
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    from_merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    to_merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. SETTLEMENT BATCHES
CREATE TABLE IF NOT EXISTS settlement_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_cycle_id UUID NOT NULL REFERENCES settlement_cycles(id) ON DELETE CASCADE,
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'GENERATED',
    total_amount_paise BIGINT NOT NULL DEFAULT 0,
    instruction_count INT NOT NULL DEFAULT 0,
    reconciled_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17. PAYMENT INSTRUCTIONS
CREATE TABLE IF NOT EXISTS payment_instructions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    redemption_id UUID NULL REFERENCES redemptions(id) ON DELETE RESTRICT,
    settlement_cycle_id UUID NULL REFERENCES settlement_cycles(id) ON DELETE RESTRICT,
    recipient_type VARCHAR(20) NOT NULL, -- CUSTOMER, MERCHANT
    recipient_id UUID NOT NULL,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
    provider_ref VARCHAR(100) NULL,
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 18. PAYMENT RESULTS
CREATE TABLE IF NOT EXISTS payment_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_instruction_id UUID NOT NULL REFERENCES payment_instructions(id) ON DELETE CASCADE,
    provider_status VARCHAR(20) NOT NULL,
    raw_payload JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 19. REFUNDS
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    reward_reversed_paise BIGINT NOT NULL CHECK (reward_reversed_paise >= 0),
    reason TEXT NOT NULL,
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 20. REVERSALS
CREATE TABLE IF NOT EXISTS reversals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
    reward_lot_id UUID NOT NULL REFERENCES reward_lots(id) ON DELETE RESTRICT,
    reversed_amount_paise BIGINT NOT NULL CHECK (reversed_amount_paise >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 21. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NULL REFERENCES networks(id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR OPTIMAL QUERY PERFORMANCE & CONCURRENCY
CREATE INDEX IF NOT EXISTS idx_merchants_network ON merchants(network_id);
CREATE INDEX IF NOT EXISTS idx_customers_network ON customers(network_id);
CREATE INDEX IF NOT EXISTS idx_transactions_network_customer ON transactions(network_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_reward_lots_customer_status ON reward_lots(customer_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_reward_lots_funding_merchant ON reward_lots(funding_merchant_id);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_customer ON reward_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_settlement_cycles_network ON settlement_cycles(network_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_instructions_idempotency ON payment_instructions(idempotency_key);
