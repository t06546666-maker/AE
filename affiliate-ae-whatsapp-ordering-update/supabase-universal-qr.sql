create table if not exists public.customer_merchants (
  customer_id uuid not null references public.customers(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  reward_points integer not null default 0 check (reward_points >= 0),
  qr_scans integer not null default 0 check (qr_scans >= 0),
  joined_at timestamptz not null default now(),
  primary key (customer_id, merchant_id)
);

insert into public.customer_merchants (
  customer_id, merchant_id, reward_points, qr_scans, joined_at
)
select id, merchant_id, reward_points, qr_scans, created_at
from public.customers
where merchant_id is not null
on conflict (customer_id, merchant_id) do update
set reward_points = excluded.reward_points,
    qr_scans = excluded.qr_scans;

create unique index if not exists customers_global_phone_unique
  on public.customers(phone);
create index if not exists customer_merchants_merchant_idx
  on public.customer_merchants(merchant_id);

alter table public.customer_merchants enable row level security;

drop policy if exists "admins manage customer memberships" on public.customer_merchants;
create policy "admins manage customer memberships" on public.customer_merchants for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "merchants read own memberships" on public.customer_merchants;
create policy "merchants read own memberships" on public.customer_merchants for select
using (merchant_id = public.current_merchant_id());

create or replace function public.process_purchase(
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
  points_earned integer,
  total_points integer,
  qr_scans integer,
  is_returning boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_membership public.customer_merchants%rowtype;
  v_merchant_name text;
  v_order public.orders%rowtype;
  v_points integer;
  v_prior_orders integer;
begin
  if p_amount <= 0 then raise exception 'Purchase amount must be greater than zero'; end if;
  if p_reward_percentage < 0.1 or p_reward_percentage > 20 then raise exception 'Invalid reward percentage'; end if;
  if p_source not in ('registration', 'qr') then raise exception 'Invalid purchase source'; end if;

  select * into v_customer
  from public.customers
  where customers.customer_code = p_customer_code
  for update;
  if not found then raise exception 'Customer not found'; end if;

  select name into v_merchant_name from public.merchants where id = p_merchant_id;
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

  v_points := floor(p_amount * p_reward_percentage / 100);

  insert into public.orders (
    order_no, customer_id, merchant_id, amount, location,
    reward_points, is_returning, source
  )
  values (
    'AE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_customer.id, p_merchant_id, p_amount, coalesce(nullif(p_location, ''), 'In-store'),
    v_points, v_prior_orders > 0, p_source
  )
  returning * into v_order;

  update public.customer_merchants
  set reward_points = reward_points + v_points,
      qr_scans = qr_scans + case when p_source = 'qr' then 1 else 0 end
  where customer_id = v_customer.id and merchant_id = p_merchant_id
  returning * into v_membership;

  return query select
    v_order.id, v_order.order_no, v_customer.id, v_customer.customer_code,
    v_customer.name, v_customer.phone, coalesce(v_customer.email, ''),
    v_merchant_name, v_order.amount, v_order.reward_points,
    v_membership.reward_points, v_membership.qr_scans,
    v_order.is_returning, v_order.created_at;
end;
$$;

revoke all on function public.process_purchase(text, uuid, numeric, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.process_purchase(text, uuid, numeric, numeric, text, text)
  to service_role;
