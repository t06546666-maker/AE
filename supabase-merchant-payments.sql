-- Payment records for verified merchant/customer UPI checkout.
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid null references public.orders(id) on delete set null,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid null references public.customers(id) on delete set null,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created','pending','paid','failed','cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_transactions_merchant_idx on public.payment_transactions(merchant_id, created_at desc);
create index if not exists payment_transactions_customer_idx on public.payment_transactions(customer_id, created_at desc);
