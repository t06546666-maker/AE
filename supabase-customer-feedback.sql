-- Customer app feedback and merchant reviews.
create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  merchant_id uuid null references public.merchants(id) on delete cascade,
  feedback_type text not null default 'app' check (feedback_type in ('app', 'merchant')),
  rating smallint null check (rating is null or rating between 1 and 5),
  message text not null check (char_length(trim(message)) between 2 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists customer_feedback_merchant_idx on public.customer_feedback(merchant_id, created_at desc);
create index if not exists customer_feedback_type_idx on public.customer_feedback(feedback_type, created_at desc);
