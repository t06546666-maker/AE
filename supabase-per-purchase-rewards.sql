alter table public.customers
  alter column reward_points type numeric(12,2)
  using reward_points::numeric(12,2);

alter table public.customer_merchants
  alter column reward_points type numeric(12,2)
  using reward_points::numeric(12,2);

alter table public.orders
  alter column reward_points type numeric(12,2)
  using reward_points::numeric(12,2);

alter table public.orders
  add column if not exists reward_percentage numeric(4,1) not null default 1.0;

alter table public.orders
  drop constraint if exists orders_reward_percentage_check;
alter table public.orders
  add constraint orders_reward_percentage_check
  check (
    reward_percentage = 0.5
    or (
      reward_percentage between 1 and 10
      and reward_percentage = trunc(reward_percentage)
    )
  );

insert into public.app_settings (key, value)
values ('reward_minimum', 0.5)
on conflict (key) do nothing;

update public.app_settings
set value = case
  when value = 0.5 then 0.5
  when value between 1 and 10 then trunc(value)
  else 1
end
where key = 'reward_percentage';

drop function if exists public.process_purchase(text, uuid, numeric, numeric, text, text);

create function public.process_purchase(
  p_customer_code text,
  p_merchant_id uuid,
  p_amount numeric,
  p_reward_percentage numeric,
  p_source text,
  p_location text default 'In-store'
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
  if p_amount < 100 then
    raise exception 'Minimum purchase amount is 100';
  end if;

  select value into v_minimum
  from public.app_settings
  where key = 'reward_minimum';
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

  select * into v_customer
  from public.customers
  where customers.customer_code = p_customer_code
  for update;
  if not found then raise exception 'Customer not found'; end if;

  select name into v_merchant_name
  from public.merchants
  where id = p_merchant_id;
  if not found then raise exception 'Merchant not found'; end if;

  insert into public.customer_merchants (customer_id, merchant_id)
  values (v_customer.id, p_merchant_id)
  on conflict (customer_id, merchant_id) do nothing;

  select * into v_membership
  from public.customer_merchants
  where customer_id = v_customer.id and merchant_id = p_merchant_id
  for update;

  select count(*) into v_prior_orders
  from public.orders
  where orders.customer_id = v_customer.id and orders.merchant_id = p_merchant_id;

  v_points := round(p_amount * p_reward_percentage / 100, 2);
  v_order_no := 'AE-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS');

  insert into public.orders (
    order_no, customer_id, merchant_id, amount, location,
    reward_points, reward_percentage, is_returning, source
  )
  values (
    v_order_no, v_customer.id, p_merchant_id, p_amount,
    coalesce(nullif(p_location, ''), 'In-store'), v_points,
    p_reward_percentage, v_prior_orders > 0, p_source
  )
  returning * into v_order;

  update public.customer_merchants
  set reward_points = reward_points + v_points,
      qr_scans = qr_scans + case when p_source = 'qr' then 1 else 0 end
  where customer_id = v_customer.id and merchant_id = p_merchant_id
  returning * into v_membership;

  return query select
    v_order.id, v_order.order_no, v_customer.id, v_customer.customer_code,
    v_customer.name, v_customer.phone, v_customer.email, v_merchant_name,
    v_order.amount, v_order.reward_percentage, v_order.reward_points,
    v_membership.reward_points, v_membership.qr_scans,
    v_order.is_returning, v_order.source, v_order.created_at;
end;
$$;

revoke all on function public.process_purchase(text, uuid, numeric, numeric, text, text)
from public;
grant execute on function public.process_purchase(text, uuid, numeric, numeric, text, text)
to authenticated, service_role;
