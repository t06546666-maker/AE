-- Customer-wide redemption. Depends on merchant-removal and atomic-points schema.
-- Changes future transactions only; does not recalculate existing balances.
begin;
create or replace function public.ae_points_transaction(
 p_merchant_id uuid, p_customer_code text, p_amount numeric, p_rate numeric,
 p_source text, p_location text, p_request_key text,
 p_redeem numeric default 0, p_discount_type text default 'percentage',
 p_discount_value numeric default 0, p_issue boolean default true
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c customers%rowtype; cm customer_merchants%rowtype; o orders%rowtype;
 red point_redemptions%rowtype; previous ae_points_requests%rowtype;
 earned numeric:=0; discount numeric:=0; pct numeric:=0; prior bigint;
 arguments jsonb; output jsonb; store_name text; network uuid; lot reward_lots%rowtype; bucket customer_merchants%rowtype; remaining bigint; consumed bigint; global_balance numeric;
begin
 if p_request_key is null or length(p_request_key) not between 1 and 120 then raise exception 'Request key required'; end if;
 if p_amount is null or p_amount<0 or (p_source<>'registration' and p_amount<1) or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid purchase amount'; end if;
 if p_redeem is null or p_redeem not in (0,100) then raise exception 'Redemption must be 0 or 100 points'; end if;
 if p_rate is null or p_rate<0 or p_rate>100 or (p_source<>'registration' and p_rate<1) or p_rate::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid earning rate'; end if;
 if p_source is null or p_source not in ('registration','qr','manual') then raise exception 'Invalid source'; end if;
 if p_issue is null or (not p_issue and p_redeem=0) then raise exception 'No points operation selected'; end if;
 arguments=jsonb_build_object('customer',p_customer_code,'amount',p_amount,'rate',p_rate,'source',p_source,'location',p_location,'redeem',p_redeem,'discountType',p_discount_type,'discountValue',p_discount_value,'issue',p_issue);
 perform pg_advisory_xact_lock(hashtextextended(p_merchant_id::text||':'||p_request_key,0));
 select * into previous from ae_points_requests where merchant_id=p_merchant_id and request_key=p_request_key;
 if found then
   if previous.parameters<>arguments then raise exception 'Request key already used for a different transaction'; end if;
   return previous.result;
 end if;
 select * into c from customers where customer_code=p_customer_code or id::text=p_customer_code for update;
 if not found then raise exception 'Customer not found'; end if;
 select name,coalesce(network_id,'00000000-0000-0000-0000-000000000000'::uuid) into store_name,network from merchants where id=p_merchant_id and deleted_at is null;
 if not found then raise exception 'Merchant not found'; end if;
 insert into customer_merchants(customer_id,merchant_id) values(c.id,p_merchant_id) on conflict do nothing;
 select * into cm from customer_merchants where customer_id=c.id and merchant_id=p_merchant_id for update;
 if p_redeem>0 then
   if coalesce(c.reward_points,0)<p_redeem then raise exception 'Customer needs 100 total points to redeem'; end if;
   if p_discount_value is null or p_discount_value<0 or p_discount_value::text in ('NaN','Infinity','-Infinity') or p_discount_type not in ('flat','percentage') then raise exception 'Invalid discount'; end if;
   discount=least(p_amount,round(case when p_discount_type='flat' then p_discount_value else p_amount*p_discount_value/100 end,2));
   pct=round(discount/p_amount*100,2);
   insert into point_redemptions(customer_id,merchant_id,transaction_amount,points_redeemed,discount_percentage,discount_amount)
   values(c.id,p_merchant_id,p_amount,p_redeem,pct,discount) returning * into red;
   remaining=round(p_redeem*100);
   for lot in select * from reward_lots where customer_id=c.id and status='AVAILABLE' and available_amount_paise>0 order by created_at,id for update loop
     exit when remaining=0;
     consumed=least(remaining,lot.available_amount_paise);
     update reward_lots set available_amount_paise=available_amount_paise-consumed,
       status=case when available_amount_paise-consumed=0 then 'EXHAUSTED' else 'AVAILABLE' end where id=lot.id;
     update customer_merchants set reward_points=greatest(0,coalesce(reward_points,0)-consumed/100.0) where customer_id=c.id and merchant_id=lot.funding_merchant_id;
     remaining=remaining-consumed;
   end loop;
   -- Legacy/unallocated points can predate funding lots. Debit remaining
   -- membership buckets without making any bucket negative. Global points
   -- remain the sole redemption eligibility requirement.
   for bucket in select * from customer_merchants where customer_id=c.id and reward_points>0 order by merchant_id for update loop
     exit when remaining=0;
     consumed=least(remaining,round(bucket.reward_points*100));
     update customer_merchants set reward_points=greatest(0,reward_points-consumed/100.0) where customer_id=c.id and merchant_id=bucket.merchant_id;
     remaining=remaining-consumed;
   end loop;
   -- Never fabricate merchant allocation or return redeemed points to a shop.
   insert into reward_ledger(network_id,customer_id,merchant_id,amount_paise,event_type,reference_id,idempotency_key)
   values(network,c.id,p_merchant_id,-round(p_redeem*100),'REWARD_REDEEMED',red.id::text,'ae-redeem:'||red.id::text);
   -- No merchant credit: redeemed customer points are consumed, not returned to allocation.
 end if;
 if p_issue then
   earned=case when p_amount<1 or p_rate=0 then 0 when p_amount<10 then 1 when p_amount<50 then 2 when p_amount<100 then 5 else least(100,round(p_amount*p_rate/100,2)) end;
   select count(*) into prior from orders where customer_id=c.id and merchant_id=p_merchant_id;
   insert into orders(order_no,customer_id,merchant_id,network_id,idempotency_key,amount,location,reward_points,reward_percentage,is_returning,source)
   values('AE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),c.id,p_merchant_id,network,'ae:'||md5(p_merchant_id::text||':'||p_request_key),p_amount,coalesce(nullif(p_location,''),'In-store'),earned,p_rate,prior>0,p_source) returning * into o;
   -- The order trigger debits exactly earned points from merchant allocation.
   insert into reward_lots(network_id,customer_id,funding_merchant_id,transaction_id,initial_amount_paise,available_amount_paise,status)
   values(network,c.id,p_merchant_id,o.id,round(earned*100),round(earned*100),'AVAILABLE');
   insert into reward_ledger(network_id,customer_id,merchant_id,transaction_id,amount_paise,event_type,idempotency_key)
   values(network,c.id,p_merchant_id,o.id,round(earned*100),'REWARD_EARNED','REWARD_EARN_'||o.id::text);
 end if;
 update customers set reward_points=coalesce(reward_points,0)+earned-p_redeem where id=c.id returning reward_points into global_balance;
 update customer_merchants set reward_points=coalesce(reward_points,0)+earned,
 qr_scans=coalesce(qr_scans,0)+case when p_issue and p_source='qr' then 1 else 0 end
 where customer_id=c.id and merchant_id=p_merchant_id returning * into cm;
 output=jsonb_build_object('purchase',case when p_issue then jsonb_build_object('order_id',o.id,'order_no',o.order_no,'customer_id',c.id,'customer_code',c.customer_code,'customer_name',c.name,'customer_phone',c.phone,'customer_email',c.email,'merchant_name',store_name,'amount',p_amount,'reward_percentage',p_rate,'points_earned',earned,'total_points',global_balance,'qr_scans',cm.qr_scans,'is_returning',prior>0,'source',p_source,'created_at',o.created_at) else null end,
 'redemption',case when p_redeem>0 then to_jsonb(red) else null end,'newBalance',global_balance,'discountAmount',discount);
 insert into ae_points_requests(merchant_id,request_key,parameters,result) values(p_merchant_id,p_request_key,arguments,output);
 return output;
end $$;
revoke all on function public.ae_points_transaction(uuid,text,numeric,numeric,text,text,text,numeric,text,numeric,boolean) from public,anon,authenticated;
grant execute on function public.ae_points_transaction(uuid,text,numeric,numeric,text,text,text,numeric,text,numeric,boolean) to service_role;
notify pgrst,'reload schema';
commit;
