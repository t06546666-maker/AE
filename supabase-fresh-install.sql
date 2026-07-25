-- RewardHub / Affiliate AE fresh Supabase installation.
-- Run once in a brand-new project after creating the first Auth user.

begin;

create extension if not exists pgcrypto;

create sequence if not exists public.merchant_number_seq
  as bigint start with 1 increment by 1 minvalue 1 cache 1;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  merchant_code text not null unique,
  name text not null,
  email text not null unique,
  phone text not null,
  created_at timestamptz not null default now()
);

create or replace function public.assign_merchant_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  merchant_number bigint;
begin
  if new.merchant_code is null or btrim(new.merchant_code) = '' then
    merchant_number := nextval('public.merchant_number_seq'::regclass);
    new.merchant_code := 'MER' || lpad(
      merchant_number::text,
      greatest(3, length(merchant_number::text)),
      '0'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.assign_merchant_code() from public;

drop trigger if exists merchants_assign_code_trigger on public.merchants;
create trigger merchants_assign_code_trigger
before insert on public.merchants
for each row
execute function public.assign_merchant_code();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'merchant')),
  merchant_id uuid references public.merchants(id) on delete restrict,
  must_change_password boolean not null default false,
  password_reset_at timestamptz,
  password_changed_at timestamptz,
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

create sequence if not exists public.order_number_seq
  as bigint start with 1 increment by 1 minvalue 1 cache 1;

create or replace function public.assign_short_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_number bigint;
begin
  v_order_number := nextval('public.order_number_seq'::regclass);
  new.order_no := 'AE' || lpad(
    v_order_number::text,
    greatest(3, length(v_order_number::text)),
    '0'
  );
  return new;
end;
$$;

revoke all on function public.assign_short_order_number() from public;

drop trigger if exists orders_short_number_trigger on public.orders;
create trigger orders_short_number_trigger
before insert on public.orders
for each row
execute function public.assign_short_order_number();

create table if not exists public.app_settings (
  key text primary key,
  value numeric not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 1000),
  image_path text not null,
  expires_at timestamptz not null,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected')
  ),
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  broadcast_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offer_campaigns (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'partial_failed', 'failed')
  ),
  total_recipients integer not null default 0,
  queued_count integer not null default 0,
  processing_count integer not null default 0,
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  read_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  meta_media_id text,
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.offer_campaigns
  add column if not exists processing_count integer not null default 0;

create table if not exists public.offer_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.offer_campaigns(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  recipient text not null,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped')
  ),
  attempts integer not null default 0 check (attempts between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  meta_message_id text unique,
  error_code text,
  error_message text,
  status_timestamp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  meta_message_id text unique,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  merchant_id uuid references public.merchants(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  campaign_id uuid references public.offer_campaigns(id) on delete set null,
  offer_recipient_id uuid references public.offer_recipients(id) on delete set null,
  message_type text not null default 'order' check (
    message_type in ('order', 'qr', 'merchant_credentials', 'offer')
  ),
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
create index if not exists offers_merchant_status_created_idx
  on public.offers(merchant_id, status, created_at desc);
create index if not exists offers_status_created_idx
  on public.offers(status, created_at desc);
create index if not exists offer_campaigns_status_updated_idx
  on public.offer_campaigns(status, updated_at);
create index if not exists offer_recipients_queue_idx
  on public.offer_recipients(status, next_attempt_at, created_at)
  where status in ('queued', 'failed');
create index if not exists offer_recipients_campaign_status_idx
  on public.offer_recipients(campaign_id, status);
create index if not exists whatsapp_messages_offer_recipient_idx
  on public.whatsapp_messages(offer_recipient_id);
create index if not exists whatsapp_messages_merchant_created_idx
  on public.whatsapp_messages(merchant_id, created_at desc);

alter table public.merchants enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_merchants enable row level security;
alter table public.orders enable row level security;
alter table public.app_settings enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.offers enable row level security;
alter table public.offer_campaigns enable row level security;
alter table public.offer_recipients enable row level security;

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
  or merchant_id = public.current_merchant_id()
  or exists (
    select 1 from public.orders as o
    where o.id = whatsapp_messages.order_id
      and o.merchant_id = public.current_merchant_id()
  )
);

drop policy if exists "staff read offers" on public.offers;
create policy "staff read offers" on public.offers for select
using (
  public.current_profile_role() = 'admin'
  or merchant_id = public.current_merchant_id()
);

drop policy if exists "merchants create offers" on public.offers;
create policy "merchants create offers" on public.offers for insert
with check (
  public.current_profile_role() = 'merchant'
  and merchant_id = public.current_merchant_id()
);

drop policy if exists "merchants update rejected offers" on public.offers;
create policy "merchants update rejected offers" on public.offers for update
using (
  public.current_profile_role() = 'merchant'
  and merchant_id = public.current_merchant_id()
  and status = 'rejected'
)
with check (
  public.current_profile_role() = 'merchant'
  and merchant_id = public.current_merchant_id()
  and status = 'pending'
);

drop policy if exists "admins manage offers" on public.offers;
create policy "admins manage offers" on public.offers for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "staff read offer campaigns" on public.offer_campaigns;
create policy "staff read offer campaigns" on public.offer_campaigns for select
using (
  public.current_profile_role() = 'admin'
  or merchant_id = public.current_merchant_id()
);

drop policy if exists "admins manage offer campaigns" on public.offer_campaigns;
create policy "admins manage offer campaigns" on public.offer_campaigns for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "staff read offer recipients" on public.offer_recipients;
create policy "staff read offer recipients" on public.offer_recipients for select
using (
  public.current_profile_role() = 'admin'
  or merchant_id = public.current_merchant_id()
);

drop policy if exists "admins manage offer recipients" on public.offer_recipients;
create policy "admins manage offer recipients" on public.offer_recipients for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

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
    null,
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

create or replace function public.create_offer_campaign(
  p_offer_id uuid,
  p_created_by uuid
)
returns table (
  campaign_id uuid,
  total_recipients integer,
  campaign_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_offer public.offers%rowtype;
  created_campaign public.offer_campaigns%rowtype;
  recipient_count integer;
begin
  select * into selected_offer
  from public.offers
  where id = p_offer_id
  for update;

  if selected_offer.id is null then raise exception 'Offer not found'; end if;
  if selected_offer.status <> 'approved' then
    raise exception 'Only approved offers can be sent';
  end if;
  if selected_offer.expires_at <= now() then
    raise exception 'Expired offers cannot be sent';
  end if;

  select * into created_campaign
  from public.offer_campaigns
  where offer_id = p_offer_id;

  if created_campaign.id is null then
    insert into public.offer_campaigns (offer_id, merchant_id, status, created_by)
    values (selected_offer.id, selected_offer.merchant_id, 'queued', p_created_by)
    returning * into created_campaign;

    insert into public.offer_recipients (
      campaign_id, offer_id, merchant_id, customer_id, recipient
    )
    select
      created_campaign.id,
      selected_offer.id,
      selected_offer.merchant_id,
      customer_row.id,
      customer_row.phone
    from public.customer_merchants as membership
    join public.customers as customer_row on customer_row.id = membership.customer_id
    where membership.merchant_id = selected_offer.merchant_id
      and customer_row.whatsapp_opt_in_at is not null
      and customer_row.phone ~ '^91[6-9][0-9]{9}$'
    on conflict (campaign_id, customer_id) do nothing;

    get diagnostics recipient_count = row_count;

    update public.offer_campaigns
    set
      total_recipients = recipient_count,
      queued_count = recipient_count,
      status = case when recipient_count = 0 then 'completed' else 'queued' end,
      completed_at = case when recipient_count = 0 then now() else null end,
      updated_at = now()
    where id = created_campaign.id
    returning * into created_campaign;

    update public.offers
    set broadcast_at = now(), updated_at = now()
    where id = selected_offer.id;
  end if;

  return query
  select created_campaign.id, created_campaign.total_recipients, created_campaign.status;
end;
$$;

revoke all on function public.create_offer_campaign(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.create_offer_campaign(uuid, uuid)
to service_role;

create or replace function public.claim_offer_recipients(p_limit integer default 20)
returns table (
  recipient_id uuid,
  campaign_id uuid,
  offer_id uuid,
  merchant_id uuid,
  customer_id uuid,
  recipient text,
  attempts integer,
  customer_name text,
  merchant_name text,
  offer_title text,
  offer_description text,
  offer_expires_at timestamptz,
  image_path text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select recipient_row.id
    from public.offer_recipients as recipient_row
    join public.offer_campaigns as campaign_row
      on campaign_row.id = recipient_row.campaign_id
    where recipient_row.status in ('queued', 'failed')
      and recipient_row.attempts < 3
      and recipient_row.next_attempt_at <= now()
      and campaign_row.status in ('queued', 'processing')
    order by recipient_row.created_at
    for update of recipient_row skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  ),
  claimed as (
    update public.offer_recipients as recipient_row
    set
      status = 'processing',
      attempts = recipient_row.attempts + 1,
      error_code = null,
      error_message = null,
      updated_at = now()
    from picked
    where recipient_row.id = picked.id
    returning recipient_row.*
  ),
  campaigns_started as (
    update public.offer_campaigns as campaign_row
    set
      status = 'processing',
      started_at = coalesce(campaign_row.started_at, now()),
      updated_at = now()
    where campaign_row.id in (select distinct claimed.campaign_id from claimed)
    returning campaign_row.id
  )
  select
    claimed.id,
    claimed.campaign_id,
    claimed.offer_id,
    claimed.merchant_id,
    claimed.customer_id,
    claimed.recipient,
    claimed.attempts,
    customer_row.name,
    merchant_row.name,
    offer_row.title,
    offer_row.description,
    offer_row.expires_at,
    offer_row.image_path
  from claimed
  join campaigns_started on campaigns_started.id = claimed.campaign_id
  join public.offers as offer_row on offer_row.id = claimed.offer_id
  join public.merchants as merchant_row on merchant_row.id = claimed.merchant_id
  left join public.customers as customer_row on customer_row.id = claimed.customer_id;
end;
$$;

revoke all on function public.claim_offer_recipients(integer)
from public, anon, authenticated;
grant execute on function public.claim_offer_recipients(integer)
to service_role;

create or replace function public.refresh_offer_campaign(p_campaign_id uuid)
returns public.offer_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count integer;
  queued_total integer;
  processing_total integer;
  sent_total integer;
  delivered_total integer;
  read_total integer;
  failed_total integer;
  skipped_total integer;
  next_status text;
  refreshed_campaign public.offer_campaigns%rowtype;
begin
  select
    count(*)::integer,
    count(*) filter (where status = 'queued')::integer,
    count(*) filter (where status = 'processing')::integer,
    count(*) filter (where status = 'sent')::integer,
    count(*) filter (where status = 'delivered')::integer,
    count(*) filter (where status = 'read')::integer,
    count(*) filter (where status = 'failed')::integer,
    count(*) filter (where status = 'skipped')::integer
  into
    total_count, queued_total, processing_total, sent_total,
    delivered_total, read_total, failed_total, skipped_total
  from public.offer_recipients
  where campaign_id = p_campaign_id;

  if queued_total + processing_total > 0 then
    next_status := 'processing';
  elsif failed_total = total_count and total_count > 0 then
    next_status := 'failed';
  elsif failed_total > 0 or skipped_total > 0 then
    next_status := 'partial_failed';
  else
    next_status := 'completed';
  end if;

  update public.offer_campaigns
  set
    status = next_status,
    total_recipients = total_count,
    queued_count = queued_total,
    processing_count = processing_total,
    sent_count = sent_total,
    delivered_count = delivered_total,
    read_count = read_total,
    failed_count = failed_total,
    skipped_count = skipped_total,
    completed_at = case
      when next_status in ('completed', 'partial_failed', 'failed')
        then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where id = p_campaign_id
  returning * into refreshed_campaign;

  return refreshed_campaign;
end;
$$;

revoke all on function public.refresh_offer_campaign(uuid)
from public, anon, authenticated;
grant execute on function public.refresh_offer_campaign(uuid)
to service_role;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'offer-images',
  'offer-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
