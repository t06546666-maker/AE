-- Apply once in Supabase SQL Editor before deploying the React frontend.
-- The migration is idempotent and keeps all existing customer/order data.

create index if not exists orders_merchant_created_idx
  on public.orders(merchant_id, created_at desc);
create index if not exists orders_customer_merchant_created_idx
  on public.orders(customer_id, merchant_id, created_at desc);
create index if not exists customer_merchants_merchant_joined_idx
  on public.customer_merchants(merchant_id, joined_at desc);
create index if not exists whatsapp_messages_order_updated_idx
  on public.whatsapp_messages(order_id, updated_at desc);

alter table public.orders
  add column if not exists idempotency_key text;
create unique index if not exists orders_idempotency_key_unique
  on public.orders(idempotency_key)
  where idempotency_key is not null;

drop function if exists public.process_purchase(text, uuid, numeric, numeric, text, text);
drop function if exists public.process_purchase(text, uuid, numeric, numeric, text, text, text);

create function public.process_purchase(
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
  v_order_no text;
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
    select c.* into v_customer from public.customers as c where c.id = v_order.customer_id;
    select m.name into v_merchant_name from public.merchants as m where m.id = v_order.merchant_id;
    select cm.* into v_membership
    from public.customer_merchants as cm
    where cm.customer_id = v_order.customer_id and cm.merchant_id = v_order.merchant_id;
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
  from public.app_settings as s
  where s.key = 'reward_minimum';
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
  if p_source not in ('registration', 'qr') then raise exception 'Invalid purchase source'; end if;

  select c.* into v_customer
  from public.customers as c
  where c.customer_code = p_customer_code
  for update;
  if not found then raise exception 'Customer not found'; end if;

  select m.name into v_merchant_name
  from public.merchants as m
  where m.id = p_merchant_id;
  if not found then raise exception 'Merchant not found'; end if;

  insert into public.customer_merchants (customer_id, merchant_id)
  values (v_customer.id, p_merchant_id)
  on conflict on constraint customer_merchants_pkey do nothing;

  select cm.* into v_membership
  from public.customer_merchants as cm
  where cm.customer_id = v_customer.id and cm.merchant_id = p_merchant_id
  for update;

  select count(*) into v_prior_orders
  from public.orders as o
  where o.customer_id = v_customer.id and o.merchant_id = p_merchant_id;

  v_points := round(p_amount * p_reward_percentage / 100, 2);
  v_order_no := 'AE-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS');

  insert into public.orders (
    order_no, customer_id, merchant_id, amount, location,
    reward_points, reward_percentage, is_returning, source, idempotency_key
  ) values (
    v_order_no, v_customer.id, p_merchant_id, p_amount,
    coalesce(nullif(p_location, ''), 'In-store'), v_points,
    p_reward_percentage, v_prior_orders > 0, p_source, p_idempotency_key
  ) returning * into v_order;

  update public.customer_merchants as cm
  set reward_points = cm.reward_points + v_points,
      qr_scans = cm.qr_scans + case when p_source = 'qr' then 1 else 0 end
  where cm.customer_id = v_customer.id and cm.merchant_id = p_merchant_id
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
from public;
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
from public;
grant execute on function public.get_dashboard_analytics(timestamptz, timestamptz, uuid)
to service_role;
