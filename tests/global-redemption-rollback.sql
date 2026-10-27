begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); low uuid:=gen_random_uuid();
 network uuid; purchase uuid; lot_id uuid; result jsonb; repeated jsonb; before_b numeric; rejected boolean:=false;
begin
 select id into network from public.networks limit 1;
 insert into public.merchants(id,name,email,phone,merchant_code,network_id,point_balance)
 values(a,'Points fixture A','fixture-'||a||'@example.invalid','9000000000','FIX-'||a,network,2000),
 (b,'Points fixture B','fixture-'||b||'@example.invalid','9000000001','FIX-'||b,network,2000);
 insert into public.customers(id,customer_code,merchant_id,name,phone,reward_points,network_id)
 values(c,'FIX-'||c,a,'Cross-shop fixture','9000000002',200,network),
 (d,'FIX-'||d,a,'Combined fixture','9000000003',100,network),
 (e,'FIX-'||e,a,'Failure fixture','9000000004',100,network),
 (low,'FIX-'||low,a,'Low balance fixture','9000000005',99,network);
 insert into public.customer_merchants(customer_id,merchant_id,reward_points) values(c,a,100),(d,a,100),(e,a,100);
 insert into public.orders(customer_id,merchant_id,amount,reward_points,network_id) values(c,a,100,0,network) returning id into purchase;
 insert into public.reward_lots(network_id,customer_id,funding_merchant_id,transaction_id,initial_amount_paise,available_amount_paise,status)
 values(network,c,a,purchase,10000,10000,'AVAILABLE') returning id into lot_id;
 result:=public.ae_points_transaction(b,c::text,25,10,'qr','Test','cross-shop',100,'percentage',5,false);
 if (result->>'newBalance')::numeric<>100 or (result->>'discountAmount')::numeric<>1.25 then raise exception 'Cross-shop/below-100 redemption failed'; end if;
 if (select reward_points from public.customers where id=c)<>100 then raise exception 'Wrong customer deduction'; end if;
 if (select reward_points from public.customer_merchants where customer_id=c and merchant_id=b)<>0 then raise exception 'New shop bucket is wrong'; end if;
 if (select available_amount_paise from public.reward_lots where id=lot_id)<>0 then raise exception 'Original funded lot not consumed'; end if;
 repeated:=public.ae_points_transaction(b,c::text,25,10,'qr','Test','cross-shop',100,'percentage',5,false);
 if repeated<>result or (select reward_points from public.customers where id=c)<>100 then raise exception 'Duplicate redemption changed balance'; end if;
 begin
  perform public.ae_points_transaction(b,low::text,25,10,'qr','Test','low',100,'percentage',5,false);
 exception when others then if sqlerrm not like '%100 total points%' then raise; end if; rejected:=true; end;
 if not rejected or (select reward_points from public.customers where id=low)<>99 then raise exception 'Low balance was accepted'; end if;
 select point_balance into before_b from public.merchants where id=b;
 result:=public.ae_points_transaction(b,d::text,10,10,'qr','Test','combined',100,'flat',50,true);
 if (result->>'newBalance')::numeric<>2 or (result->>'discountAmount')::numeric<>10 then raise exception 'Combined small-bill result incorrect'; end if;
 if (select reward_points from public.customer_merchants where customer_id=d and merchant_id=a)<>0 or
    (select reward_points from public.customer_merchants where customer_id=d and merchant_id=b)<>2 then raise exception 'Membership buckets inconsistent'; end if;
 if (select point_balance from public.merchants where id=b)<>before_b-2 then raise exception 'Redemption credited/debited merchant incorrectly'; end if;
 update public.merchants set point_balance=0 where id=b;
 rejected:=false;
 begin
  perform public.ae_points_transaction(b,e::text,10,10,'qr','Test','fail',100,'percentage',5,true);
 exception when others then if sqlerrm not like '%Insufficient merchant points%' then raise; end if; rejected:=true; end;
 if not rejected or (select reward_points from public.customers where id=e)<>100 or exists(select 1 from public.point_redemptions where customer_id=e) then raise exception 'Failed combined checkout partially redeemed points'; end if;
 if exists(select 1 from public.customer_merchants where customer_id in(c,d,e,low) and reward_points<0) then raise exception 'Negative shop bucket'; end if;
end $$;
rollback;
select 'PASS: new-shop redemption at Rs25, global 100-point minimum, FIFO funding, duplicate replay, Rs10 combined redemption, capped discount, no negative buckets, merchant allocation and rollback on failure. All fixtures rolled back.' as result;
