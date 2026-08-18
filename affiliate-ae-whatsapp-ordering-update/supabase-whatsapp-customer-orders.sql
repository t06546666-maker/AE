-- Affiliate AE WhatsApp customer ordering. Run this once in the Supabase SQL Editor.
-- This is intentionally separate from reward-purchase orders: reward points are only
-- awarded by the existing registration and QR checkout flow.

create sequence if not exists public.customer_order_number_seq start with 1;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  price numeric(12,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  customer_note text not null default '',
  total_amount numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity between 1 and 99),
  unit_price numeric(12,2),
  item_type text not null check (item_type in ('catalog', 'custom')),
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_customer_sessions (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  phone text not null,
  merchant_id uuid references public.merchants(id) on delete set null,
  state text not null default 'merchant',
  cart jsonb not null default '[]'::jsonb,
  pending_item jsonb,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  meta_message_id text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  sender text not null,
  message_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table if not exists public.merchant_notifications (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_order_id uuid not null references public.customer_orders(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (merchant_id, customer_order_id)
);

alter table public.whatsapp_messages add column if not exists customer_order_id uuid references public.customer_orders(id) on delete set null;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.whatsapp_messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%message_type%'
  loop
    execute format('alter table public.whatsapp_messages drop constraint %I', constraint_name);
  end loop;
  alter table public.whatsapp_messages add constraint whatsapp_messages_message_type_check
    check (message_type in ('order', 'qr', 'merchant_credentials', 'offer', 'customer_order', 'customer_order_status'));
end $$;

create index if not exists products_merchant_active_idx on public.products(merchant_id, active, name);
create index if not exists customer_orders_merchant_created_idx on public.customer_orders(merchant_id, created_at desc);
create index if not exists customer_orders_customer_created_idx on public.customer_orders(customer_id, created_at desc);
create index if not exists customer_order_items_order_idx on public.customer_order_items(customer_order_id);
create index if not exists merchant_notifications_unread_idx on public.merchant_notifications(merchant_id, read_at, created_at desc);
create index if not exists whatsapp_messages_customer_order_idx on public.whatsapp_messages(customer_order_id);

create or replace function public.create_customer_order(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_cart jsonb
)
returns table(order_id uuid, request_no text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_request_no text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_name text;
  v_total numeric(12,2) := 0;
  v_has_catalog boolean := false;
begin
  if not exists (select 1 from public.customers c where c.id = p_customer_id) then
    raise exception 'Customer not found';
  end if;
  if not exists (select 1 from public.merchants m where m.id = p_merchant_id) then
    raise exception 'Merchant not found';
  end if;
  if jsonb_typeof(p_cart) <> 'array' or jsonb_array_length(p_cart) = 0 then
    raise exception 'Cart cannot be empty';
  end if;

  v_request_no := 'REQ-' || lpad(nextval('public.customer_order_number_seq')::text, 4, '0');
  insert into public.customer_orders (request_no, customer_id, merchant_id, total_amount)
  values (v_request_no, p_customer_id, p_merchant_id, 0)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_cart)
  loop
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_quantity not between 1 and 99 then
      raise exception 'Invalid item quantity';
    end if;
    if coalesce(v_item ->> 'type', '') = 'catalog' then
      select * into v_product from public.products p
      where p.id = (v_item ->> 'productId')::uuid
        and p.merchant_id = p_merchant_id and p.active = true;
      if not found then raise exception 'A selected product is no longer available'; end if;
      insert into public.customer_order_items (customer_order_id, product_id, product_name, quantity, unit_price, item_type)
      values (v_order_id, v_product.id, v_product.name, v_quantity, v_product.price, 'catalog');
      v_total := v_total + (v_product.price * v_quantity);
      v_has_catalog := true;
    else
      v_name := btrim(coalesce(v_item ->> 'name', ''));
      if char_length(v_name) = 0 or char_length(v_name) > 500 then
        raise exception 'Invalid custom request';
      end if;
      insert into public.customer_order_items (customer_order_id, product_name, quantity, unit_price, item_type)
      values (v_order_id, v_name, v_quantity, null, 'custom');
    end if;
  end loop;

  update public.customer_orders o
  set total_amount = case when v_has_catalog then v_total else null end, updated_at = now()
  where o.id = v_order_id;
  insert into public.merchant_notifications (merchant_id, customer_order_id, title, body)
  values (p_merchant_id, v_order_id, 'New WhatsApp order', 'New customer request ' || v_request_no)
  on conflict (merchant_id, customer_order_id) do nothing;
  return query select v_order_id, v_request_no;
end;
$$;

alter table public.products enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;
alter table public.merchant_notifications enable row level security;

drop policy if exists products_admin_all on public.products;
drop policy if exists products_merchant_own on public.products;
create policy products_admin_all on public.products for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy products_merchant_own on public.products for all using (
  merchant_id = (select p.merchant_id from public.profiles p where p.id = auth.uid())
) with check (
  merchant_id = (select p.merchant_id from public.profiles p where p.id = auth.uid())
);

drop policy if exists customer_orders_admin_all on public.customer_orders;
drop policy if exists customer_orders_merchant_own on public.customer_orders;
create policy customer_orders_admin_all on public.customer_orders for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy customer_orders_merchant_own on public.customer_orders for select using (
  merchant_id = (select p.merchant_id from public.profiles p where p.id = auth.uid())
);

drop policy if exists merchant_notifications_admin_all on public.merchant_notifications;
drop policy if exists merchant_notifications_merchant_own on public.merchant_notifications;
create policy merchant_notifications_admin_all on public.merchant_notifications for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy merchant_notifications_merchant_own on public.merchant_notifications for all using (
  merchant_id = (select p.merchant_id from public.profiles p where p.id = auth.uid())
) with check (
  merchant_id = (select p.merchant_id from public.profiles p where p.id = auth.uid())
);
