-- Isolated fixture test. All fixture inserts/removals roll back together.
begin;
do $$
declare shop uuid:=gen_random_uuid(); person uuid:=gen_random_uuid(); account uuid:=gen_random_uuid();
 admin_id uuid; network uuid; purchase uuid; payment uuid; before_customer jsonb; customer_count bigint; balances numeric;
begin
 select id into admin_id from public.profiles where role='admin' limit 1;
 select id into network from public.networks limit 1;
 insert into public.merchants(id,name,email,phone,merchant_code,network_id,point_balance)
 values(shop,'Removal rollback fixture','fixture-'||shop||'@example.invalid','9000000000','FIX-'||shop,network,2000);
 insert into auth.users(id,email,instance_id,aud,role,created_at,updated_at)
 values(account,'fixture-'||account||'@example.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),now());
 insert into public.profiles(id,full_name,role,merchant_id) values(account,'Removal fixture','merchant',shop);
 insert into public.customers(id,customer_code,merchant_id,name,phone,reward_points,created_by,network_id)
 values(person,'FIX-'||person,shop,'Customer fixture','9000000001',37,account,network);
 insert into public.orders(customer_id,merchant_id,amount,created_by,network_id)
 values(person,shop,100,account,network) returning id into purchase;
 insert into public.payment_transactions(order_id,merchant_id,customer_id,amount,status) values(purchase,shop,person,100,'paid') returning id into payment;
 select to_jsonb(c)-'created_by' into before_customer from public.customers c where id=person;
 select count(*),sum(reward_points) into customer_count,balances from public.customers;
 perform public.admin_remove_merchant(admin_id,shop);
 if exists(select 1 from auth.users where id=account) or exists(select 1 from public.profiles where id=account) then raise exception 'Login was retained'; end if;
 if exists(select 1 from public.active_merchants where id=shop) then raise exception 'Shop is still active'; end if;
 if not exists(select 1 from public.merchants where id=shop and name='Deleted merchant' and phone='' and deleted_at is not null) then raise exception 'History reference not scrubbed'; end if;
 if (select to_jsonb(c)-'created_by' from public.customers c where id=person) is distinct from before_customer then raise exception 'Customer data/balance changed'; end if;
 if not exists(select 1 from public.orders where id=purchase and customer_id=person and amount=100) then raise exception 'Customer purchase lost'; end if;
 if not exists(select 1 from public.payment_transactions where id=payment and customer_id=person and amount=100 and status='paid') then raise exception 'Customer payment lost'; end if;
 if (select count(*) from public.customers)<>customer_count or (select sum(reward_points) from public.customers)<>balances then raise exception 'Customer totals changed'; end if;
 perform public.admin_remove_merchant(admin_id,shop);
 if (select count(*) from public.merchant_removal_jobs where merchant_id=shop)<>1 then raise exception 'Duplicate removal job'; end if;
 raise notice 'PASS: merchant login removed, active directory hidden, contact details scrubbed, customer data/points/purchase preserved, repeat removal idempotent. Fixtures rolled back.';
end $$;
rollback;
