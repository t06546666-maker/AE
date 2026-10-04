-- Apply after supabase-loyalty.sql. Existing balances are preserved; no historical purchases are charged.
begin;
alter table public.merchants add column if not exists point_balance numeric(14,2) not null default 0;
alter table public.merchants alter column point_balance type numeric(14,2);
update public.merchants set point_balance=0 where point_balance is null;
alter table public.merchants alter column point_balance set default 0;
alter table public.merchants alter column point_balance set not null;
alter table public.merchants add constraint merchant_allocated_balance_nonnegative check(point_balance>=0);

create table public.merchant_point_allocations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id),
  admin_id uuid not null references public.profiles(id),
  points integer not null check(points between 1 and 1000000),
  request_id uuid not null unique,
  created_at timestamptz not null default now()
);
alter table public.merchant_point_allocations enable row level security;
revoke all on public.merchant_point_allocations from anon, authenticated;
grant all on public.merchant_point_allocations to service_role;

create function public.allocate_merchant_points(p_merchant_id uuid,p_admin_id uuid,p_points integer,p_request_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare existing public.merchant_point_allocations; balance numeric;
begin
  if not exists(select 1 from profiles where id=p_admin_id and role='admin') then raise exception 'Admin access required'; end if;
  if p_points is null or p_points<1 or p_points>1000000 then raise exception 'Points must be between 1 and 1,000,000'; end if;
  select point_balance into balance from merchants where id=p_merchant_id for update;
  if not found then raise exception 'Merchant not found'; end if;
  select * into existing from merchant_point_allocations where request_id=p_request_id;
  if found then
    if existing.merchant_id<>p_merchant_id or existing.points<>p_points or existing.admin_id<>p_admin_id then raise exception 'Allocation request mismatch'; end if;
    return balance;
  end if;
  insert into merchant_point_allocations(merchant_id,admin_id,points,request_id) values(p_merchant_id,p_admin_id,p_points,p_request_id);
  update merchants set point_balance=point_balance+p_points where id=p_merchant_id returning point_balance into balance;
  return balance;
end $$;
revoke all on function public.allocate_merchant_points(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.allocate_merchant_points(uuid,uuid,integer,uuid) to service_role;

-- A conditional UPDATE locks the merchant row and prevents concurrent issues overdrawing the balance.
-- Runs within the purchase/bonus transaction: any later failure rolls the deduction back.
create function public.debit_allocated_merchant_points() returns trigger language plpgsql security definer set search_path=public as $$
declare charge numeric;
begin
  if TG_TABLE_NAME='orders' then
    charge=greatest(0,coalesce(NEW.reward_points,0));
    if TG_OP='UPDATE' then
      if NEW.merchant_id is distinct from OLD.merchant_id then raise exception 'Cannot transfer a purchase between merchants'; end if;
      charge=greatest(0,coalesce(NEW.reward_points,0)-coalesce(OLD.reward_points,0));
    end if;
  else charge=NEW.points;
  end if;
  if charge>0 then
    update merchants set point_balance=point_balance-charge where id=NEW.merchant_id and point_balance>=charge;
    if not found then raise exception 'Insufficient merchant points. Ask Admin to allocate more points.'; end if;
  end if;
  return NEW;
end $$;
revoke all on function public.debit_allocated_merchant_points() from public,anon,authenticated;
create trigger orders_debit_allocated_points before insert or update of reward_points,merchant_id on public.orders for each row execute function public.debit_allocated_merchant_points();
create trigger loyalty_debit_allocated_points before insert on public.loyalty_bonuses for each row execute function public.debit_allocated_merchant_points();
commit;
