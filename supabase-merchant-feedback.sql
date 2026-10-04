begin;
create table if not exists public.merchant_feedback (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  request_id uuid not null unique,
  category text not null check(category in ('App experience','Points & redemption','QR scanning','Product lists','Support','Suggestion','Other')),
  rating smallint check(rating between 1 and 5),
  message text not null check(char_length(trim(message)) between 2 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists merchant_feedback_created_idx on public.merchant_feedback(created_at desc);
alter table public.merchant_feedback enable row level security;
revoke all on public.merchant_feedback from anon,authenticated;
grant all on public.merchant_feedback to service_role;
commit;
