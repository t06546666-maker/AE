begin;
alter table public.customer_product_list_requests
  add column if not exists merchant_status text;
alter table public.customer_product_list_requests
  drop constraint if exists customer_product_list_requests_merchant_status_check;
alter table public.customer_product_list_requests
  add constraint customer_product_list_requests_merchant_status_check
  check (merchant_status is null or merchant_status in ('confirmed','in_progress','ready','rejected'));

-- Preserve previously accepted requests from installations whose status
-- constraint already allowed accepted. Admin review remains approved.
update public.customer_product_list_requests
set status = 'approved', merchant_status = 'confirmed'
where status = 'accepted' and merchant_status is null;

-- Requests and decisions are served by authenticated server endpoints only.
alter table public.customer_product_list_requests enable row level security;
revoke all on public.customer_product_list_requests from anon, authenticated;
commit;
