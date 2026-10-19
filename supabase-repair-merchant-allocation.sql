-- Targeted repair for the missing Admin -> merchant allocation RPC.
-- Does not credit points, recalculate balances, or install/change debit triggers.
-- Run this file, NOT the older full allocation migration, on an existing app.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.merchant_point_allocations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id),
  admin_id uuid not null references public.profiles(id),
  points integer not null check (points between 1 and 1000000),
  request_id uuid not null unique,
  created_at timestamptz not null default now()
);
alter table public.merchant_point_allocations enable row level security;
revoke all on public.merchant_point_allocations from public, anon, authenticated;
grant all on public.merchant_point_allocations to service_role;

-- Fail safely if another allocation implementation was installed meanwhile.
-- Re-running this repair after success leaves the existing function untouched.
do $repair$
begin
  if to_regprocedure('public.allocate_merchant_points(uuid,uuid,integer,uuid)') is null then
    execute $definition$
      create function public.allocate_merchant_points(
        p_merchant_id uuid, p_admin_id uuid, p_points integer, p_request_id uuid
      ) returns numeric
      language plpgsql security definer set search_path = '' as $function$
      declare
        previous public.merchant_point_allocations%rowtype;
        balance numeric;
      begin
        if p_merchant_id is null or p_admin_id is null or p_request_id is null then
          raise exception 'Merchant, admin and request ID are required';
        end if;
        if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then
          raise exception 'Admin access required';
        end if;
        if p_points is null or p_points < 1 or p_points > 1000000 then
          raise exception 'Points must be between 1 and 1,000,000';
        end if;
        -- Serialise replays globally, including a changed merchant on a retry.
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
        select point_balance into balance from public.merchants
          where id = p_merchant_id for update;
        if not found then raise exception 'Merchant not found'; end if;
        if balance is null or balance < 0 then raise exception 'Merchant balance needs review'; end if;
        select * into previous from public.merchant_point_allocations where request_id = p_request_id;
        if found then
          if previous.merchant_id <> p_merchant_id or previous.admin_id <> p_admin_id or previous.points <> p_points then
            raise exception 'Allocation request mismatch';
          end if;
          return balance;
        end if;
        insert into public.merchant_point_allocations(merchant_id, admin_id, points, request_id)
          values (p_merchant_id, p_admin_id, p_points, p_request_id);
        update public.merchants set point_balance = point_balance + p_points
          where id = p_merchant_id returning point_balance into balance;
        return balance;
      end;
      $function$;
    $definition$;
  end if;
end;
$repair$;
revoke all on function public.allocate_merchant_points(uuid,uuid,integer,uuid) from public, anon, authenticated;
grant execute on function public.allocate_merchant_points(uuid,uuid,integer,uuid) to service_role;
notify pgrst, 'reload schema';
commit;

-- Read-only confirmation; this does not call the function or credit any points.
select to_regprocedure('public.allocate_merchant_points(uuid,uuid,integer,uuid)') is not null as allocation_function_ready;
