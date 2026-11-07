-- Migration: Add pickup_time column to customer_product_list_requests
alter table public.customer_product_list_requests
  add column if not exists pickup_time text;

