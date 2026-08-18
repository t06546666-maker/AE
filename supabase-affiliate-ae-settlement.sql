-- ============================================================================
-- Affiliate AE Reward & Settlement Engine - PostgreSQL Migration
-- All financial amounts are stored as BIGINT representing integer paise (INR).
-- ============================================================================

begin;

-- 1. NETWORKS
create table if not exists public.networks (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    currency text not null default 'INR',
    reward_rate_bps integer not null default 100, -- 1% = 100 bps
    min_redemption_threshold_paise bigint not null default 10000, -- ₹100 = 10000 paise
    created_at timestamptz not null default now()
);

-- Ensure a default "Legacy" network exists for existing merchants/customers
insert into public.networks (id, code, name)
values ('00000000-0000-0000-0000-000000000000', 'LEGACY-001', 'Legacy Network')
on conflict (code) do nothing;

-- Modify Merchants to belong to a network
alter table public.merchants 
add column if not exists network_id uuid references public.networks(id) on delete restrict,
add column if not exists reward_rate_bps integer null,
add column if not exists bank_details jsonb not null default '{}'::jsonb;

-- Assign default network to existing merchants
update public.merchants set network_id = '00000000-0000-0000-0000-000000000000' where network_id is null;

alter table public.merchants alter column network_id set not null;

-- Modify Customers to belong to a network
alter table public.customers 
add column if not exists network_id uuid references public.networks(id) on delete restrict,
add column if not exists upi_id text null;

update public.customers set network_id = '00000000-0000-0000-0000-000000000000' where network_id is null;

alter table public.customers alter column network_id set not null;

-- Modify Orders (Transactions) to belong to a network, and add idempotency key
alter table public.orders 
add column if not exists network_id uuid references public.networks(id) on delete restrict,
add column if not exists idempotency_key text unique;

update public.orders set network_id = '00000000-0000-0000-0000-000000000000' where network_id is null;
alter table public.orders alter column network_id set not null;

-- 6. REWARD RULES
create table if not exists public.reward_rules (
    id uuid primary key default gen_random_uuid(),
    network_id uuid not null references public.networks(id) on delete restrict,
    merchant_id uuid null references public.merchants(id) on delete restrict,
    reward_rate_bps integer not null check (reward_rate_bps >= 0),
    active boolean not null default true,
    created_at timestamptz not null default now()
);

-- 7. REWARD LOTS
create table if not exists public.reward_lots (
    id uuid primary key default gen_random_uuid(),
    network_id uuid not null references public.networks(id) on delete restrict,
    customer_id uuid not null references public.customers(id) on delete restrict,
    funding_merchant_id uuid not null references public.merchants(id) on delete restrict,
    transaction_id uuid not null references public.orders(id) on delete restrict,
    initial_amount_paise bigint not null check (initial_amount_paise >= 0),
    available_amount_paise bigint not null check (available_amount_paise >= 0),
    status text not null default 'AVAILABLE', -- AVAILABLE, RESERVED, EXHAUSTED, REVERSED
    created_at timestamptz not null default now()
);

-- 8. REWARD LEDGER (IMMUTABLE EVENT LOG)
create table if not exists public.reward_ledger (
    id uuid primary key default gen_random_uuid(),
    network_id uuid not null references public.networks(id) on delete restrict,
    customer_id uuid null references public.customers(id) on delete restrict,
    merchant_id uuid null references public.merchants(id) on delete restrict,
    transaction_id uuid null references public.orders(id) on delete restrict,
    amount_paise bigint not null,
    currency text not null default 'INR',
    event_type text not null, -- REWARD_EARNED, REWARD_REVERSED, REWARD_RESERVED, REWARD_RELEASED, REWARD_REDEEMED, REFUND
    reference_id text null,
    metadata jsonb null,
    idempotency_key text not null unique,
    created_at timestamptz not null default now()
);

-- 9. REDEMPTIONS
create table if not exists public.redemptions (
    id uuid primary key default gen_random_uuid(),
    network_id uuid not null references public.networks(id) on delete restrict,
    customer_id uuid not null references public.customers(id) on delete restrict,
    type text not null, -- UPI_PAYOUT, NETWORK_VOUCHER
    amount_paise bigint not null check (amount_paise > 0),
    status text not null default 'REQUESTED', -- REQUESTED, RESERVED, PROCESSING, SUCCEEDED, FAILED, CANCELLED
    redeeming_merchant_id uuid null references public.merchants(id) on delete restrict,
    payout_instruction_id uuid null,
    idempotency_key text unique not null,
    created_at timestamptz not null default now()
);

-- 10. REDEMPTION ALLOCATIONS (FIFO CONSUMPTION TRACKING)
create table if not exists public.redemption_allocations (
    id uuid primary key default gen_random_uuid(),
    redemption_id uuid not null references public.redemptions(id) on delete cascade,
    reward_lot_id uuid not null references public.reward_lots(id) on delete restrict,
    funding_merchant_id uuid not null references public.merchants(id) on delete restrict,
    amount_consumed_paise bigint not null check (amount_consumed_paise > 0),
    created_at timestamptz not null default now()
);

-- 11. VOUCHERS
create table if not exists public.vouchers (
    id uuid primary key default gen_random_uuid(),
    network_id uuid not null references public.networks(id) on delete restrict,
    customer_id uuid not null references public.customers(id) on delete restrict,
    redemption_id uuid not null references public.redemptions(id) on delete restrict,
    code text unique not null,
    original_value_paise bigint not null check (original_value_paise > 0),
    remaining_value_paise bigint not null check (remaining_value_paise >= 0),
    status text not null default 'ISSUED', -- ISSUED, PARTIALLY_REDEEMED, FULLY_REDEEMED, EXPIRED, CANCELLED
    issued_at timestamptz not null default now(),
    expires_at timestamptz not null,
    redeemed_at timestamptz null,
    redeeming_merchant_id uuid null references public.merchants(id) on delete restrict
);

-- 12. VOUCHER REDEMPTIONS
create table if not exists public.voucher_redemptions (
    id uuid primary key default gen_random_uuid(),
    voucher_id uuid not null references public.vouchers(id) on delete restrict,
    redeeming_merchant_id uuid not null references public.merchants(id) on delete restrict,
    amount_redeemed_paise bigint not null check (amount_redeemed_paise > 0),
    redeemed_at timestamptz not null default now()
);

-- 13. SETTLEMENT CYCLES
create table if not exists public.settlement_cycles (
    id uuid primary key default gen_random_uuid(),
    network_id uuid not null references public.networks(id) on delete restrict,
    period_start timestamptz not null,
    period_end timestamptz not null,
    status text not null default 'OPEN', -- OPEN, FROZEN, CALCULATING, RECONCILED, RECONCILIATION_FAILED, BATCH_GENERATED, SETTLED, EXCEPTION
    total_payables_paise bigint not null default 0,
    total_receivables_paise bigint not null default 0,
    reconciled_at timestamptz null,
    created_at timestamptz not null default now()
);

-- 14. MERCHANT LEDGER (SETTLEMENT POSITIONS)
create table if not exists public.merchant_ledger (
    id uuid primary key default gen_random_uuid(),
    network_id uuid not null references public.networks(id) on delete restrict,
    settlement_cycle_id uuid not null references public.settlement_cycles(id) on delete cascade,
    merchant_id uuid not null references public.merchants(id) on delete restrict,
    receivable_paise bigint not null default 0,
    payable_paise bigint not null default 0,
    net_amount_paise bigint not null default 0,
    position_type text not null, -- PAY, RECEIVE, BALANCED
    created_at timestamptz not null default now(),
    constraint uk_merchant_settlement_cycle unique (settlement_cycle_id, merchant_id)
);

-- 15. MERCHANT FUNDING OBLIGATIONS (SETTLEMENT LINES)
create table if not exists public.merchant_funding_obligations (
    id uuid primary key default gen_random_uuid(),
    settlement_cycle_id uuid not null references public.settlement_cycles(id) on delete cascade,
    network_id uuid not null references public.networks(id) on delete restrict,
    funding_merchant_id uuid not null references public.merchants(id) on delete restrict,
    receiving_merchant_id uuid null references public.merchants(id) on delete restrict,
    customer_id uuid not null references public.customers(id) on delete restrict,
    redemption_id uuid not null references public.redemptions(id) on delete restrict,
    reward_lot_id uuid not null references public.reward_lots(id) on delete restrict,
    amount_paise bigint not null check (amount_paise > 0),
    status text not null default 'PENDING',
    created_at timestamptz not null default now()
);

-- 16. SETTLEMENT BATCHES
create table if not exists public.settlement_batches (
    id uuid primary key default gen_random_uuid(),
    settlement_cycle_id uuid not null references public.settlement_cycles(id) on delete cascade,
    network_id uuid not null references public.networks(id) on delete restrict,
    status text not null default 'GENERATED',
    total_amount_paise bigint not null default 0,
    instruction_count integer not null default 0,
    reconciled_at timestamptz not null,
    created_at timestamptz not null default now()
);

-- 17. PAYMENT INSTRUCTIONS
create table if not exists public.payment_instructions (
    id uuid primary key default gen_random_uuid(),
    network_id uuid not null references public.networks(id) on delete restrict,
    redemption_id uuid null references public.redemptions(id) on delete restrict,
    settlement_cycle_id uuid null references public.settlement_cycles(id) on delete restrict,
    recipient_type text not null, -- CUSTOMER, MERCHANT
    recipient_id uuid not null,
    amount_paise bigint not null check (amount_paise > 0),
    status text not null default 'PENDING', -- PENDING, SUCCESS, FAILED
    provider_ref text null,
    idempotency_key text unique not null,
    created_at timestamptz not null default now()
);

-- 18. PAYMENT RESULTS
create table if not exists public.payment_results (
    id uuid primary key default gen_random_uuid(),
    payment_instruction_id uuid not null references public.payment_instructions(id) on delete cascade,
    provider_status text not null,
    raw_payload jsonb null,
    created_at timestamptz not null default now()
);

-- 19. REFUNDS
create table if not exists public.refunds (
    id uuid primary key default gen_random_uuid(),
    transaction_id uuid not null references public.orders(id) on delete restrict,
    network_id uuid not null references public.networks(id) on delete restrict,
    merchant_id uuid not null references public.merchants(id) on delete restrict,
    customer_id uuid not null references public.customers(id) on delete restrict,
    amount_paise bigint not null check (amount_paise > 0),
    reward_reversed_paise bigint not null check (reward_reversed_paise >= 0),
    reason text not null,
    idempotency_key text unique not null,
    created_at timestamptz not null default now()
);

-- 20. REVERSALS
create table if not exists public.reversals (
    id uuid primary key default gen_random_uuid(),
    refund_id uuid not null references public.refunds(id) on delete cascade,
    reward_lot_id uuid not null references public.reward_lots(id) on delete restrict,
    reversed_amount_paise bigint not null check (reversed_amount_paise >= 0),
    created_at timestamptz not null default now()
);

-- 21. AUDIT LOGS
create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    network_id uuid null references public.networks(id) on delete set null,
    entity_type text not null,
    entity_id text not null,
    action text not null,
    actor text not null default 'SYSTEM',
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

commit;
