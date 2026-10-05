begin;
alter table public.merchants add column if not exists redeem_discount_type text not null default 'percentage' check(redeem_discount_type in ('percentage','flat'));
alter table public.merchants add column if not exists redeem_flat_amount numeric(12,2) not null default 50 check(redeem_flat_amount between 0 and 1000000);
commit;
