alter table public.customers
  add column if not exists whatsapp_opt_in_at timestamptz;

alter table public.orders
  add column if not exists reward_points integer not null default 0,
  add column if not exists is_returning boolean not null default false,
  add column if not exists source text not null default 'registration';

alter table public.orders
  drop constraint if exists orders_source_check;
alter table public.orders
  add constraint orders_source_check check (source in ('registration', 'qr'));

with ranked as (
  select id, row_number() over (partition by customer_id order by created_at, id) as visit_number
  from public.orders
)
update public.orders o
set is_returning = ranked.visit_number > 1
from ranked
where ranked.id = o.id;

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  meta_message_id text unique,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  template_name text not null,
  recipient text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_code text,
  error_message text,
  status_timestamp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_order_id_idx
  on public.whatsapp_messages(order_id);
create index if not exists whatsapp_messages_customer_id_idx
  on public.whatsapp_messages(customer_id);

alter table public.whatsapp_messages enable row level security;

drop policy if exists "staff read whatsapp messages" on public.whatsapp_messages;
create policy "staff read whatsapp messages" on public.whatsapp_messages for select
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.orders o
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
  v_merchant_name text;
  v_order public.orders%rowtype;
  v_points integer;
  v_prior_orders integer;
begin
  if p_amount <= 0 then
    raise exception 'Purchase amount must be greater than zero';
  end if;
  if p_reward_percentage < 0.1 or p_reward_percentage > 20 then
    raise exception 'Invalid reward percentage';
  end if;
  if p_source not in ('registration', 'qr') then
    raise exception 'Invalid purchase source';
  end if;

  select * into v_customer
  from public.customers
  where customers.customer_code = p_customer_code
    and customers.merchant_id = p_merchant_id
  for update;

  if not found then
    raise exception 'Customer not found for this merchant';
  end if;

  select name into v_merchant_name
  from public.merchants
  where id = p_merchant_id;

  select count(*) into v_prior_orders
  from public.orders
  where orders.customer_id = v_customer.id;

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

  update public.customers
  set reward_points = reward_points + v_points,
      qr_scans = qr_scans + case when p_source = 'qr' then 1 else 0 end
  where id = v_customer.id
  returning * into v_customer;

  return query select
    v_order.id,
    v_order.order_no,
    v_customer.id,
    v_customer.customer_code,
    v_customer.name,
    v_customer.phone,
    coalesce(v_customer.email, ''),
    v_merchant_name,
    v_order.amount,
    v_order.reward_points,
    v_customer.reward_points,
    v_customer.qr_scans,
    v_order.is_returning,
    v_order.created_at;
end;
$$;

revoke all on function public.process_purchase(text, uuid, numeric, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.process_purchase(text, uuid, numeric, numeric, text, text)
  to service_role;
