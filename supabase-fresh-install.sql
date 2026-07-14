-- RewardHub / Affiliate AE fresh Supabase installation.
-- Run once in a brand-new project after creating the first Auth user.

begin;

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
    (role = 'admin' and merchant_id is null)
    or (role = 'merchant' and merchant_id is not null)
  )
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null unique,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  name text not null,
  phone text not null unique,
  email text,
  reward_points numeric(12,2) not null default 0 check (reward_points >= 0),
  qr_scans integer not null default 0 check (qr_scans >= 0),
  whatsapp_opt_in_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_merchants (
  customer_id uuid not null references public.customers(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  reward_points numeric(12,2) not null default 0 check (reward_points >= 0),
  qr_scans integer not null default 0 check (qr_scans >= 0),
  joined_at timestamptz not null default now(),
  primary key (customer_id, merchant_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 100),
  location text not null default 'In-store',
  reward_points numeric(12,2) not null default 0 check (reward_points >= 0),
  reward_percentage numeric(4,1) not null default 1.0 check (
    reward_percentage = 0.5
    or (
      reward_percentage between 1 and 10
      and reward_percentage = trunc(reward_percentage)
    )
  ),
  is_returning boolean not null default false,
  source text not null default 'registration' check (source in ('registration', 'qr')),
  idempotency_key text,
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

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  meta_message_id text unique,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  template_name text not null,
  recipient text not null,
  status text not null default 'queued' check (
    status in ('queued', 'sent', 'delivered', 'read', 'failed')
  ),
  error_code text,
  error_message text,
  status_timestamp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('reward_percentage', 1), ('reward_minimum', 0.5)
on conflict (key) do nothing;

create index if not exists customers_merchant_id_idx
  on public.customers(merchant_id);
create index if not exists orders_merchant_created_idx
  on public.orders(merchant_id, created_at desc);
create index if not exists orders_customer_merchant_created_idx
  on public.orders(customer_id, merchant_id, created_at desc);
create unique index if not exists orders_idempotency_key_unique
  on public.orders(idempotency_key) where idempotency_key is not null;
create index if not exists customer_merchants_merchant_joined_idx
  on public.customer_merchants(merchant_id, joined_at desc);
create index if not exists whatsapp_messages_order_updated_idx
  on public.whatsapp_messages(order_id, updated_at desc);
create index if not exists whatsapp_messages_customer_id_idx
  on public.whatsapp_messages(customer_id);

alter table public.merchants enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_merchants enable row level security;
alter table public.orders enable row level security;
alter table public.app_settings enable row level security;
alter table public.whatsapp_messages enable row level security;

create or replace function public.current_profile_role()
returns text
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_merchant_id()
returns uuid
language sql stable security definer set search_path = public
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

drop policy if exists "admins manage customer memberships" on public.customer_merchants;
create policy "admins manage customer memberships" on public.customer_merchants for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "merchants read own memberships" on public.customer_merchants;
create policy "merchants read own memberships" on public.customer_merchants for select
using (merchant_id = public.current_merchant_id());

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

drop policy if exists "staff read whatsapp messages" on public.whatsapp_messages;
create policy "staff read whatsapp messages" on public.whatsapp_messages for select
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1 from public.orders as o
    where o.id = whatsapp_messages.order_id
      and o.merchant_id = public.current_merchant_id()
  )
);

create or replace function public.process_purchase(
  p_customer_code text,
  p_merchant_id uuid,
  p_amount numeric,
  p_reward_percentage numeric,
  p_source text,
  p_location text,
  p_idempotency_key text
)
returns table (
  order_id uuid,
  order_no text,
  customer_id uuid,
  customer_code text,
  customer_name text,
  customer_phone text,
  customer_email text,
  merchant_name text,
  amount numeric,
  reward_percentage numeric,
  points_earned numeric,
  total_points numeric,
  qr_scans integer,
  is_returning boolean,
  source text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_membership public.customer_merchants%rowtype;
  v_order public.orders%rowtype;
  v_merchant_name text;
  v_points numeric(12,2);
  v_minimum numeric;
  v_prior_orders integer;
begin
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select o.* into v_order
  from public.orders as o
  where o.idempotency_key = p_idempotency_key
    and o.merchant_id = p_merchant_id;

  if found then
    select c.* into v_customer
    from public.customers as c where c.id = v_order.customer_id;
    select m.name into v_merchant_name
    from public.merchants as m where m.id = v_order.merchant_id;
    select cm.* into v_membership
    from public.customer_merchants as cm
    where cm.customer_id = v_order.customer_id
      and cm.merchant_id = v_order.merchant_id;
    return query select
      v_order.id, v_order.order_no, v_customer.id, v_customer.customer_code,
      v_customer.name, v_customer.phone, v_customer.email, v_merchant_name,
      v_order.amount, v_order.reward_percentage, v_order.reward_points,
      v_membership.reward_points, v_membership.qr_scans,
      v_order.is_returning, v_order.source, v_order.created_at;
    return;
  end if;

  if p_amount < 100 then raise exception 'Minimum purchase amount is 100'; end if;

  select s.value into v_minimum
  from public.app_settings as s where s.key = 'reward_minimum';
  v_minimum := coalesce(v_minimum, 0.5);

  if not (
    p_reward_percentage = 0.5
    or (
      p_reward_percentage between 1 and 10
      and p_reward_percentage = trunc(p_reward_percentage)
    )
  ) then raise exception 'Invalid reward percentage'; end if;
  if p_reward_percentage < v_minimum then
    raise exception 'Reward percentage is below the admin minimum';
  end if;
  if p_source not in ('registration', 'qr') then
    raise exception 'Invalid purchase source';
  end if;

  select c.* into v_customer
  from public.customers as c
  where c.customer_code = p_customer_code
  for update;
  if not found then raise exception 'Customer not found'; end if;

  select m.name into v_merchant_name
  from public.merchants as m where m.id = p_merchant_id;
  if not found then raise exception 'Merchant not found'; end if;

  insert into public.customer_merchants (customer_id, merchant_id)
  values (v_customer.id, p_merchant_id)
  on conflict on constraint customer_merchants_pkey do nothing;

  select cm.* into v_membership
  from public.customer_merchants as cm
  where cm.customer_id = v_customer.id
    and cm.merchant_id = p_merchant_id
  for update;

  select count(*) into v_prior_orders
  from public.orders as o
  where o.customer_id = v_customer.id
    and o.merchant_id = p_merchant_id;

  v_points := round(p_amount * p_reward_percentage / 100, 2);

  insert into public.orders (
    order_no, customer_id, merchant_id, amount, location,
    reward_points, reward_percentage, is_returning, source, idempotency_key
  ) values (
    'AE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    v_customer.id, p_merchant_id, p_amount,
    coalesce(nullif(p_location, ''), 'In-store'), v_points,
    p_reward_percentage, v_prior_orders > 0, p_source, p_idempotency_key
  ) returning * into v_order;

  update public.customer_merchants as cm
  set reward_points = cm.reward_points + v_points,
      qr_scans = cm.qr_scans + case when p_source = 'qr' then 1 else 0 end
  where cm.customer_id = v_customer.id
    and cm.merchant_id = p_merchant_id
  returning * into v_membership;

  return query select
    v_order.id, v_order.order_no, v_customer.id, v_customer.customer_code,
    v_customer.name, v_customer.phone, v_customer.email, v_merchant_name,
    v_order.amount, v_order.reward_percentage, v_order.reward_points,
    v_membership.reward_points, v_membership.qr_scans,
    v_order.is_returning, v_order.source, v_order.created_at;
end;
$$;

revoke all on function public.process_purchase(text, uuid, numeric, numeric, text, text, text)
from public, anon, authenticated;
grant execute on function public.process_purchase(text, uuid, numeric, numeric, text, text, text)
to service_role;

create or replace function public.get_dashboard_analytics(
  p_from timestamptz,
  p_to timestamptz,
  p_merchant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_orders bigint;
  v_total_revenue numeric;
  v_total_points numeric;
  v_total_customers bigint;
  v_lifetime_retained bigint;
  v_selected_visits bigint;
  v_today_visits bigint;
  v_week_visits bigint;
  v_month_visits bigint;
  v_intervals jsonb;
  v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  v_week timestamptz := date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  v_month timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'Valid from and to dates are required';
  end if;

  select count(*), coalesce(sum(o.amount), 0), coalesce(sum(o.reward_points), 0),
         count(*) filter (where o.is_returning)
  into v_total_orders, v_total_revenue, v_total_points, v_selected_visits
  from public.orders as o
  where o.created_at >= p_from and o.created_at < p_to
    and (p_merchant_id is null or o.merchant_id = p_merchant_id);

  if p_merchant_id is null then
    select count(*) into v_total_customers
    from public.customers as c
    where c.created_at >= p_from and c.created_at < p_to;
  else
    select count(*) into v_total_customers
    from public.customer_merchants as cm
    where cm.merchant_id = p_merchant_id
      and cm.joined_at >= p_from and cm.joined_at < p_to;
  end if;

  select count(*) into v_lifetime_retained
  from (
    select o.customer_id
    from public.orders as o
    where p_merchant_id is null or o.merchant_id = p_merchant_id
    group by o.customer_id
    having count(*) >= 2
  ) as retained;

  select
    count(*) filter (where o.created_at >= v_today),
    count(*) filter (where o.created_at >= v_week),
    count(*) filter (where o.created_at >= v_month)
  into v_today_visits, v_week_visits, v_month_visits
  from public.orders as o
  where o.is_returning
    and (p_merchant_id is null or o.merchant_id = p_merchant_id);

  with slots as (
    select generate_series(0, 3) as slot
  ), grouped as (
    select
      floor(extract(hour from timezone('Asia/Kolkata', o.created_at)) / 6)::integer as slot,
      count(*) as orders,
      coalesce(sum(o.amount), 0) as revenue
    from public.orders as o
    where o.created_at >= p_from and o.created_at < p_to
      and (p_merchant_id is null or o.merchant_id = p_merchant_id)
    group by 1
  )
  select jsonb_agg(jsonb_build_object(
    'label', lpad((s.slot * 6)::text, 2, '0') || '-' || lpad(((s.slot + 1) * 6)::text, 2, '0'),
    'orders', coalesce(g.orders, 0),
    'revenue', coalesce(g.revenue, 0)
  ) order by s.slot)
  into v_intervals
  from slots as s
  left join grouped as g on g.slot = s.slot;

  return jsonb_build_object(
    'success', true,
    'summary', jsonb_build_object(
      'totalOrders', coalesce(v_total_orders, 0),
      'totalRevenue', coalesce(v_total_revenue, 0),
      'rewardPointsIssued', coalesce(v_total_points, 0),
      'totalCustomers', coalesce(v_total_customers, 0)
    ),
    'intervals', coalesce(v_intervals, '[]'::jsonb),
    'retention', jsonb_build_object(
      'lifetimeCustomers', coalesce(v_lifetime_retained, 0),
      'selectedVisits', coalesce(v_selected_visits, 0),
      'todayVisits', coalesce(v_today_visits, 0),
      'weekVisits', coalesce(v_week_visits, 0),
      'monthVisits', coalesce(v_month_visits, 0)
    )
  );
end;
$$;

revoke all on function public.get_dashboard_analytics(timestamptz, timestamptz, uuid)
from public, anon, authenticated;
grant execute on function public.get_dashboard_analytics(timestamptz, timestamptz, uuid)
to service_role;

-- This creates the first admin profile when the Auth user already exists.
insert into public.profiles (id, full_name, role, merchant_id)
select id, 'Affiliate AE Admin', 'admin', null
from auth.users
where lower(email) = 'affiliateae1@gmail.com'
on conflict (id) do update
set full_name = excluded.full_name,
    role = 'admin',
    merchant_id = null;

commit;

select
  (select count(*) from public.merchants) as merchants,
  (select count(*) from public.profiles where role = 'admin') as admins,
  (select count(*) from public.app_settings) as settings,
  'RewardHub database setup complete' as status;
