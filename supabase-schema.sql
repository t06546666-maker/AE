-- Run this once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'merchant')),
  merchant_id uuid references public.merchants(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint merchant_role_assignment check (
    (role = 'admin' and merchant_id is null) or
    (role = 'merchant' and merchant_id is not null)
  )
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null unique,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  name text not null,
  phone text not null,
  email text,
  reward_points integer not null default 0 check (reward_points >= 0),
  qr_scans integer not null default 0 check (qr_scans >= 0),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  location text not null default 'In-store',
  whatsapp_sent boolean not null default false,
  email_sent boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value numeric not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('reward_percentage', 1)
on conflict (key) do nothing;

create index if not exists customers_merchant_id_idx on public.customers(merchant_id);
create index if not exists orders_merchant_id_idx on public.orders(merchant_id);
create index if not exists orders_customer_id_idx on public.orders(customer_id);

alter table public.merchants enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.app_settings enable row level security;

create or replace function public.current_profile_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_merchant_id()
returns uuid language sql stable security definer set search_path = public
as $$ select merchant_id from public.profiles where id = auth.uid() $$;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles for select
using (id = auth.uid());

drop policy if exists "admins manage merchants" on public.merchants;
create policy "admins manage merchants" on public.merchants for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "merchants read own store" on public.merchants;
create policy "merchants read own store" on public.merchants for select
using (id = public.current_merchant_id());

drop policy if exists "staff read customers" on public.customers;
create policy "staff read customers" on public.customers for select
using (
  public.current_profile_role() = 'admin'
  or merchant_id = public.current_merchant_id()
);

drop policy if exists "staff create customers" on public.customers;
create policy "staff create customers" on public.customers for insert
with check (
  public.current_profile_role() = 'admin'
  or merchant_id = public.current_merchant_id()
);

drop policy if exists "staff read orders" on public.orders;
create policy "staff read orders" on public.orders for select
using (
  public.current_profile_role() = 'admin'
  or merchant_id = public.current_merchant_id()
);

drop policy if exists "staff create orders" on public.orders;
create policy "staff create orders" on public.orders for insert
with check (
  public.current_profile_role() = 'admin'
  or merchant_id = public.current_merchant_id()
);

drop policy if exists "staff read settings" on public.app_settings;
create policy "staff read settings" on public.app_settings for select
using (public.current_profile_role() in ('admin', 'merchant'));

drop policy if exists "admins manage settings" on public.app_settings;
create policy "admins manage settings" on public.app_settings for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

-- After creating your first Auth user, promote it to admin:
-- insert into public.profiles (id, full_name, role)
-- select id, 'Admin User', 'admin' from auth.users where email = 'admin@example.com'
-- on conflict (id) do update set full_name = excluded.full_name, role = 'admin', merchant_id = null;
