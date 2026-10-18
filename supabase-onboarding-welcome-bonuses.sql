-- Apply after supabase-merchant-point-allocation.sql and the customer/reward
-- schema migrations. These are platform-funded, one-time welcome grants.
begin;

create table if not exists public.merchant_onboarding_bonuses (
  merchant_id uuid primary key references public.merchants(id) on delete restrict,
  points integer not null default 2000 check (points = 2000),
  created_at timestamptz not null default now()
);
alter table public.merchant_onboarding_bonuses enable row level security;
revoke all on public.merchant_onboarding_bonuses from public, anon, authenticated;
grant all on public.merchant_onboarding_bonuses to service_role;

create or replace function public.grant_merchant_onboarding_bonus(p_merchant_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare current_balance numeric; existing_bonus public.merchant_onboarding_bonuses%rowtype;
begin
  select point_balance into current_balance
  from public.merchants where id=p_merchant_id for update;
  if not found then raise exception 'Merchant not found'; end if;

  select * into existing_bonus
  from public.merchant_onboarding_bonuses where merchant_id=p_merchant_id;
  if found then return current_balance; end if;

  insert into public.merchant_onboarding_bonuses(merchant_id,points)
  values(p_merchant_id,2000);
  update public.merchants
  set point_balance=coalesce(point_balance,0)+2000
  where id=p_merchant_id returning point_balance into current_balance;
  return current_balance;
end;
$$;
revoke all on function public.grant_merchant_onboarding_bonus(uuid) from public, anon, authenticated;
grant execute on function public.grant_merchant_onboarding_bonus(uuid) to service_role;

create table if not exists public.customer_onboarding_bonuses (
  customer_id uuid primary key references public.customers(id) on delete restrict,
  merchant_id uuid null references public.merchants(id) on delete restrict,
  points integer not null default 200 check (points = 200),
  created_at timestamptz not null default now()
);
alter table public.customer_onboarding_bonuses enable row level security;
revoke all on public.customer_onboarding_bonuses from public, anon, authenticated;
grant all on public.customer_onboarding_bonuses to service_role;

create or replace function public.grant_customer_onboarding_bonus(
  p_customer_id uuid,
  p_merchant_id uuid default null
) returns integer language plpgsql security definer set search_path=public as $$
declare bonus_row public.customer_onboarding_bonuses%rowtype;
begin
  perform 1 from public.customers where id=p_customer_id for update;
  if not found then raise exception 'Customer not found'; end if;

  insert into public.customer_onboarding_bonuses(customer_id,merchant_id,points)
  values(p_customer_id,p_merchant_id,200)
  on conflict(customer_id) do nothing
  returning * into bonus_row;

  if found then
    update public.customers
    set reward_points=coalesce(reward_points,0)+200
    where id=p_customer_id;
    if p_merchant_id is not null then
      update public.customer_merchants
      set reward_points=coalesce(reward_points,0)+200
      where customer_id=p_customer_id and merchant_id=p_merchant_id;
      if not found then raise exception 'Customer merchant membership not found'; end if;
    end if;
    return 200;
  end if;

  -- A self-signup can later join its first shop. Attach the already-awarded
  -- global bonus to that first membership without granting it a second time.
  select * into bonus_row
  from public.customer_onboarding_bonuses
  where customer_id=p_customer_id for update;
  if p_merchant_id is not null and bonus_row.merchant_id is null then
    update public.customer_merchants
    set reward_points=coalesce(reward_points,0)+bonus_row.points
    where customer_id=p_customer_id and merchant_id=p_merchant_id;
    if found then
      update public.customer_onboarding_bonuses
      set merchant_id=p_merchant_id
      where customer_id=p_customer_id and merchant_id is null;
    end if;
  end if;
  return bonus_row.points;
end;
$$;
revoke all on function public.grant_customer_onboarding_bonus(uuid,uuid) from public, anon, authenticated;
grant execute on function public.grant_customer_onboarding_bonus(uuid,uuid) to service_role;

-- Claim the customer welcome award on first successful app sign-in. The JSON
-- result lets the API notify only the sign-in that actually received points.
create or replace function public.claim_customer_onboarding_bonus(
  p_customer_id uuid,
  p_merchant_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare bonus_row public.customer_onboarding_bonuses%rowtype; current_balance numeric;
begin
  select reward_points into current_balance
  from public.customers where id=p_customer_id for update;
  if not found then raise exception 'Customer not found'; end if;

  select * into bonus_row
  from public.customer_onboarding_bonuses where customer_id=p_customer_id for update;
  if not found then
    insert into public.customer_onboarding_bonuses(customer_id,merchant_id,points)
    values(p_customer_id,p_merchant_id,200)
    returning * into bonus_row;

    update public.customers
    set reward_points=coalesce(reward_points,0)+200
    where id=p_customer_id returning reward_points into current_balance;
    if p_merchant_id is not null then
      update public.customer_merchants
      set reward_points=coalesce(reward_points,0)+200
      where customer_id=p_customer_id and merchant_id=p_merchant_id;
      if not found then raise exception 'Customer merchant membership not found'; end if;
    end if;
    return jsonb_build_object('awarded',true,'points',200,'balance',current_balance);
  end if;

  -- Attach a previously awarded global signup bonus to the first merchant
  -- membership, without granting a second bonus.
  if p_merchant_id is not null and bonus_row.merchant_id is null then
    update public.customer_merchants
    set reward_points=coalesce(reward_points,0)+bonus_row.points
    where customer_id=p_customer_id and merchant_id=p_merchant_id;
    if found then
      update public.customer_onboarding_bonuses
      set merchant_id=p_merchant_id where customer_id=p_customer_id;
    end if;
  end if;
  select reward_points into current_balance from public.customers where id=p_customer_id;
  return jsonb_build_object('awarded',false,'points',bonus_row.points,'balance',current_balance);
end;
$$;
revoke all on function public.claim_customer_onboarding_bonus(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_customer_onboarding_bonus(uuid,uuid) to service_role;

create or replace function public.attach_pending_customer_welcome_bonus()
returns trigger language plpgsql security definer set search_path=public as $$
declare bonus_points integer;
begin
  update public.customer_onboarding_bonuses
  set merchant_id=new.merchant_id
  where customer_id=new.customer_id and merchant_id is null
  returning points into bonus_points;
  if found then
    update public.customer_merchants
    set reward_points=coalesce(reward_points,0)+bonus_points
    where customer_id=new.customer_id and merchant_id=new.merchant_id;
  end if;
  return new;
end;
$$;
revoke all on function public.attach_pending_customer_welcome_bonus() from public, anon, authenticated;
drop trigger if exists customer_merchants_attach_welcome_bonus on public.customer_merchants;
create trigger customer_merchants_attach_welcome_bonus
after insert on public.customer_merchants
for each row execute function public.attach_pending_customer_welcome_bonus();

notify pgrst,'reload schema';
commit;
