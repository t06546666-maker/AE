-- Affiliate AE merchant feedback and WhatsApp shopping-list photo attachments.
-- Run this after supabase-whatsapp-customer-orders.sql in the Supabase SQL Editor.

begin;

create table if not exists public.customer_order_images (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders(id) on delete cascade,
  storage_path text not null,
  caption text not null default '',
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  created_at timestamptz not null default now(),
  unique (customer_order_id, storage_path)
);

create index if not exists customer_order_images_order_idx on public.customer_order_images(customer_order_id);

create table if not exists public.merchant_feedback (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists merchant_feedback_merchant_created_idx on public.merchant_feedback(merchant_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-order-images',
  'customer-order-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.customer_order_images enable row level security;
alter table public.merchant_feedback enable row level security;

drop policy if exists customer_order_images_admin_select on public.customer_order_images;
drop policy if exists customer_order_images_merchant_select on public.customer_order_images;
create policy customer_order_images_admin_select on public.customer_order_images for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy customer_order_images_merchant_select on public.customer_order_images for select using (
  exists (
    select 1 from public.customer_orders o
    join public.profiles p on p.merchant_id = o.merchant_id
    where o.id = customer_order_images.customer_order_id and p.id = auth.uid()
  )
);

drop policy if exists merchant_feedback_admin_select on public.merchant_feedback;
drop policy if exists merchant_feedback_merchant_select on public.merchant_feedback;
drop policy if exists merchant_feedback_merchant_insert on public.merchant_feedback;
create policy merchant_feedback_admin_select on public.merchant_feedback for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy merchant_feedback_merchant_select on public.merchant_feedback for select using (
  merchant_id = (select p.merchant_id from public.profiles p where p.id = auth.uid())
);
create policy merchant_feedback_merchant_insert on public.merchant_feedback for insert with check (
  merchant_id = (select p.merchant_id from public.profiles p where p.id = auth.uid())
);

drop policy if exists customer_order_images_storage_admin_select on storage.objects;
drop policy if exists customer_order_images_storage_merchant_select on storage.objects;
create policy customer_order_images_storage_admin_select on storage.objects for select using (
  bucket_id = 'customer-order-images'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy customer_order_images_storage_merchant_select on storage.objects for select using (
  bucket_id = 'customer-order-images'
  and split_part(name, '/', 1) = (
    select p.merchant_id::text from public.profiles p where p.id = auth.uid()
  )
);

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
  v_image_path text;
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

      v_image_path := btrim(coalesce(v_item ->> 'imagePath', ''));
      if v_image_path <> '' then
        if v_image_path not like (p_merchant_id::text || '/' || p_customer_id::text || '/%') then
          raise exception 'Invalid customer photo attachment';
        end if;
        insert into public.customer_order_images (customer_order_id, storage_path, caption, mime_type)
        values (
          v_order_id,
          v_image_path,
          left(v_name, 500),
          case lower(coalesce(v_item ->> 'imageType', ''))
            when 'image/png' then 'image/png'
            when 'image/webp' then 'image/webp'
            else 'image/jpeg'
          end
        )
        on conflict (customer_order_id, storage_path) do nothing;
      end if;
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

commit;
