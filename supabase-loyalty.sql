-- Apply in Supabase SQL Editor before deploying loyalty APIs.
begin;
alter table public.offers add column if not exists audience text not null default 'all'
  check (audience in ('all', 'loyal'));
create table if not exists public.loyalty_bonuses (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id),
  customer_id uuid not null references public.customers(id),
  points integer not null check (points between 1 and 100),
  request_id uuid not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (merchant_id, request_id)
);
alter table public.loyalty_bonuses enable row level security;
revoke all on public.loyalty_bonuses from anon, authenticated;
grant all on public.loyalty_bonuses to service_role;
create index if not exists loyalty_purchase_idx on public.orders(merchant_id,customer_id);
-- Bonus lots have no purchase; retain their separate source for expiry/FIFO.
alter table public.reward_lots alter column transaction_id drop not null;
alter table public.reward_lots add column if not exists loyalty_bonus_id uuid references public.loyalty_bonuses(id);

create or replace function public.loyal_customers(p_merchant_id uuid)
returns table(id uuid,name text,purchases bigint)
language sql stable security definer set search_path=public as $$
  select c.id,c.name,count(o.id) from customers c join orders o on o.customer_id=c.id
  where o.merchant_id=p_merchant_id group by c.id,c.name having count(o.id)>=5;
$$;
revoke all on function public.loyal_customers(uuid) from public,anon,authenticated;
grant execute on function public.loyal_customers(uuid) to service_role;

create or replace function public.award_loyalty_bonus(p_merchant_id uuid,p_customer_id uuid,p_points integer,p_request_id uuid,p_created_by uuid)
returns public.loyalty_bonuses language plpgsql security definer set search_path=public as $$
declare result public.loyalty_bonuses; purchase_count bigint; merchant_network uuid;
begin
  if p_points is null or p_points<1 or p_points>100 then raise exception 'Bonus must be 1–100 points'; end if;
  if not exists(select 1 from profiles where id=p_created_by and role='merchant' and merchant_id=p_merchant_id) then raise exception 'Merchant access required'; end if;
  perform 1 from customers where id=p_customer_id for update;
  if not found then raise exception 'Customer not found'; end if;
  select * into result from loyalty_bonuses where merchant_id=p_merchant_id and request_id=p_request_id;
  if found then
    if result.customer_id<>p_customer_id or result.points<>p_points then raise exception 'Request ID already used'; end if;
    return result;
  end if;
  select count(*) into purchase_count from orders where merchant_id=p_merchant_id and customer_id=p_customer_id;
  if purchase_count<5 then raise exception 'Customer needs five purchases at this merchant'; end if;
  update customer_merchants set reward_points=reward_points+p_points where customer_id=p_customer_id and merchant_id=p_merchant_id;
  if not found then raise exception 'Customer membership not found'; end if;
  update customers set reward_points=reward_points+p_points where id=p_customer_id;
  insert into loyalty_bonuses(merchant_id,customer_id,points,request_id,created_by)
  values(p_merchant_id,p_customer_id,p_points,p_request_id,p_created_by) returning * into result;
  select network_id into merchant_network from merchants where id=p_merchant_id;
  insert into reward_lots(network_id,customer_id,funding_merchant_id,loyalty_bonus_id,initial_amount_paise,available_amount_paise)
  values(merchant_network,p_customer_id,p_merchant_id,result.id,p_points*100,p_points*100);
  insert into reward_ledger(network_id,customer_id,merchant_id,amount_paise,event_type,reference_id,idempotency_key)
  values(merchant_network,p_customer_id,p_merchant_id,p_points*100,'LOYALTY_BONUS',result.id::text,'loyalty:'||result.id::text);
  return result;
end; $$;
revoke all on function public.award_loyalty_bonus(uuid,uuid,integer,uuid,uuid) from public,anon,authenticated;
grant execute on function public.award_loyalty_bonus(uuid,uuid,integer,uuid,uuid) to service_role;
create or replace function public.create_offer_campaign(
  p_offer_id uuid,
  p_created_by uuid
)
returns table (
  campaign_id uuid,
  total_recipients integer,
  campaign_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_offer public.offers%rowtype;
  created_campaign public.offer_campaigns%rowtype;
  recipient_count integer;
begin
  select offer_row.*
  into selected_offer
  from public.offers as offer_row
  where offer_row.id = p_offer_id
  for update;

  if selected_offer.id is null then
    raise exception 'Offer not found';
  end if;
  if selected_offer.status <> 'approved' then
    raise exception 'Only approved offers can be sent';
  end if;
  if selected_offer.expires_at <= now() then
    raise exception 'Expired offers cannot be sent';
  end if;

  select campaign_row.*
  into created_campaign
  from public.offer_campaigns as campaign_row
  where campaign_row.offer_id = p_offer_id;

  if created_campaign.id is null then
    insert into public.offer_campaigns (
      offer_id,
      merchant_id,
      status,
      created_by
    )
    values (
      selected_offer.id,
      selected_offer.merchant_id,
      'queued',
      p_created_by
    )
    returning * into created_campaign;

    insert into public.offer_recipients (
      campaign_id,
      offer_id,
      merchant_id,
      customer_id,
      recipient
    )
    select
      created_campaign.id,
      selected_offer.id,
      selected_offer.merchant_id,
      customer_row.id,
      customer_row.phone
    from public.customer_merchants as membership
    join public.customers as customer_row
      on customer_row.id = membership.customer_id
    where membership.merchant_id = selected_offer.merchant_id
      and (selected_offer.audience = 'all' or (select count(*) from public.orders o where o.merchant_id=selected_offer.merchant_id and o.customer_id=customer_row.id)>=5)
      and customer_row.whatsapp_opt_in_at is not null
      and customer_row.phone ~ '^91[6-9][0-9]{9}$'
    on conflict do nothing;

    get diagnostics recipient_count = row_count;

    update public.offer_campaigns as campaign_row
    set
      total_recipients = recipient_count,
      queued_count = recipient_count,
      status = case when recipient_count = 0 then 'completed' else 'queued' end,
      completed_at = case when recipient_count = 0 then now() else null end,
      updated_at = now()
    where campaign_row.id = created_campaign.id
    returning campaign_row.* into created_campaign;

    update public.offers as offer_row
    set broadcast_at = now(), updated_at = now()
    where offer_row.id = selected_offer.id;
  end if;

  return query
  select
    created_campaign.id,
    created_campaign.total_recipients,
    created_campaign.status;
end;
$$;

revoke all on function public.create_offer_campaign(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.create_offer_campaign(uuid, uuid)
to service_role;
commit;
