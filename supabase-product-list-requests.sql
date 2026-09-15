create table if not exists public.customer_product_list_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  product_list text,
  image_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (nullif(trim(product_list), '') is not null or image_path is not null)
);
create index if not exists customer_product_list_requests_merchant_idx on public.customer_product_list_requests(merchant_id, status, created_at desc);
