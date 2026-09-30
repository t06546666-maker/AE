-- Load-test data for the AE dashboard.
-- Creates 1,000 merchants and 10,000 customers with the LOADTEST prefix.
-- Safe to run more than once: the unique codes/emails/phones prevent duplicates.
-- This intentionally does not create Auth users, orders, rewards, or WhatsApp jobs.

begin;

insert into public.merchants (merchant_code, name, email, phone, network_id)
select
  'LOADM' || lpad(n::text, 4, '0'),
  'Load Test Merchant ' || lpad(n::text, 4, '0'),
  'loadtest.merchant.' || lpad(n::text, 4, '0') || '@example.test',
  '919900' || lpad(n::text, 6, '0'),
  '00000000-0000-0000-0000-000000000000'
from generate_series(1, 1000) as series(n)
on conflict do nothing;

insert into public.customers (customer_code, merchant_id, name, phone, email, network_id)
select
  'LOADC' || lpad(c.n::text, 5, '0'),
  m.id,
  'Load Test Customer ' || lpad(c.n::text, 5, '0'),
  '918800' || lpad(c.n::text, 6, '0'),
  'loadtest.customer.' || lpad(c.n::text, 5, '0') || '@example.test',
  '00000000-0000-0000-0000-000000000000'
from generate_series(1, 10000) as c(n)
join public.merchants m
  on m.merchant_code = 'LOADM' || lpad((((c.n - 1) % 1000) + 1)::text, 4, '0')
on conflict do nothing;

insert into public.customer_merchants (customer_id, merchant_id)
select c.id, c.merchant_id
from public.customers c
where c.customer_code like 'LOADC%'
on conflict do nothing;

commit;

-- Verification (should return 1,000 and 10,000 after a clean run):
select count(*) as load_test_merchants
from public.merchants
where merchant_code like 'LOADM%';

select count(*) as load_test_customers
from public.customers
where customer_code like 'LOADC%';
