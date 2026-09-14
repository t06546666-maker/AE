-- Customer self-signup support.
-- Existing merchant-created customers remain linked to their merchant.

alter table public.customers
  alter column merchant_id drop not null;

alter table public.customers
  add column if not exists registration_source text not null default 'merchant';

alter table public.customers
  drop constraint if exists customers_registration_source_check;

alter table public.customers
  add constraint customers_registration_source_check
  check (registration_source in ('merchant', 'self'));

update public.customers
set registration_source = 'merchant'
where registration_source is null;

create index if not exists customers_registration_source_idx
  on public.customers(registration_source, created_at desc);
