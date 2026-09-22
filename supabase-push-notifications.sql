-- Push notification registration for customers, merchants, and admins.
-- Run once in Supabase SQL editor before enabling production push notifications.
begin;

alter table public.customers
  add column if not exists push_token text,
  add column if not exists push_enabled boolean not null default true;

alter table public.profiles
  add column if not exists push_token text,
  add column if not exists push_enabled boolean not null default true;

create index if not exists profiles_push_enabled_idx
  on public.profiles(role, merchant_id)
  where push_enabled = true and push_token is not null;

commit;
