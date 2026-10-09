-- Remove only the exact records created by supabase-load-test-seed.sql.
-- Run in the correct Supabase project's SQL Editor. No Auth users were seeded.
-- If any guard fails, the transaction aborts: do not bypass the guard.
begin;

create temporary table ae_load_merchants on commit drop as
select m.id from public.merchants m
join generate_series(1,1000) n on m.merchant_code = 'LOADM' || lpad(n::text,4,'0')
where m.email = 'loadtest.merchant.' || lpad(n::text,4,'0') || '@example.test'
  and m.phone = '919900' || lpad(n::text,6,'0');

create temporary table ae_load_customers on commit drop as
select c.id from public.customers c
join generate_series(1,10000) n on c.customer_code = 'LOADC' || lpad(n::text,5,'0')
where c.email = 'loadtest.customer.' || lpad(n::text,5,'0') || '@example.test'
  and c.phone = '918800' || lpad(n::text,6,'0');

select (select count(*) from ae_load_merchants) as merchants_to_remove,
       (select count(*) from ae_load_customers) as customers_to_remove;

do $$
begin
  if (select count(*) from ae_load_merchants) <> 1000
     or (select count(*) from ae_load_customers) <> 10000 then
    raise exception 'Exact seed counts do not match. Nothing deleted. Inspect the matching records first.';
  end if;
  if exists (
    select 1 from public.customers c
    join ae_load_merchants m on m.id = c.merchant_id
    where not exists(select 1 from ae_load_customers t where t.id = c.id)
  ) or exists (
    select 1 from public.customer_merchants cm
    join ae_load_merchants m on m.id = cm.merchant_id
    where not exists(select 1 from ae_load_customers t where t.id = cm.customer_id)
  ) then
    raise exception 'A non-test customer is linked to a test merchant. Nothing deleted. Review those links first.';
  end if;
  if exists(select 1 from public.profiles p join ae_load_merchants m on m.id = p.merchant_id) then
    raise exception 'An authenticated account is linked to a seed merchant. Nothing deleted. Review it separately.';
  end if;
end $$;

delete from public.customer_merchants cm using ae_load_customers t where cm.customer_id = t.id;
delete from public.customers c using ae_load_customers t where c.id = t.id;
delete from public.merchants m using ae_load_merchants t where m.id = t.id;

-- Remaining original seed codes should both be zero.
select (select count(*) from public.merchants where merchant_code ~ '^LOADM[0-9]{4}$') as remaining_seed_merchants,
       (select count(*) from public.customers where customer_code ~ '^LOADC[0-9]{5}$') as remaining_seed_customers;
commit;
