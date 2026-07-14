-- Run once in Supabase SQL Editor to repair the ambiguous customer_id error.
-- This replaces only the purchase function and preserves all existing data.

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
    from public.customers as c
    where c.id = v_order.customer_id;

    select m.name into v_merchant_name
    from public.merchants as m
    where m.id = v_order.merchant_id;

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

  if p_amount < 100 then
    raise exception 'Minimum purchase amount is 100';
  end if;

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
  ) then
    raise exception 'Invalid reward percentage';
  end if;
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
  from public.merchants as m
  where m.id = p_merchant_id;
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
