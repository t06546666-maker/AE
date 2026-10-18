-- Admin-funded promotional grants to selected customers.
-- Apply in Supabase SQL Editor after the customers/customer_merchants schema exists.
begin;

create table if not exists public.admin_customer_point_grants (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  points integer not null check (points between 1 and 1000000),
  request_id uuid not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (customer_id, request_id)
);
alter table public.admin_customer_point_grants enable row level security;
revoke all on public.admin_customer_point_grants from public, anon, authenticated;
grant all on public.admin_customer_point_grants to service_role;

create table if not exists public.admin_customer_point_grant_batches (
  request_id uuid primary key,
  customer_ids uuid[] not null,
  points integer not null check (points between 1 and 1000000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 1 and 300),
  created_at timestamptz not null default now()
);
alter table public.admin_customer_point_grant_batches enable row level security;
revoke all on public.admin_customer_point_grant_batches from public, anon, authenticated;
grant all on public.admin_customer_point_grant_batches to service_role;

create or replace function public.admin_grant_customer_points(
  p_customer_ids uuid[],
  p_points integer,
  p_request_id uuid,
  p_created_by uuid,
  p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_customer_id uuid;
  grant_row public.admin_customer_point_grants%rowtype;
  batch_row public.admin_customer_point_grant_batches%rowtype;
  awarded_ids uuid[] := '{}'::uuid[];
  unique_ids uuid[];
begin
  if not exists (select 1 from public.profiles where id=p_created_by and role='admin') then
    raise exception 'Admin access required';
  end if;
  if p_points is null or p_points < 1 or p_points > 1000000 then
    raise exception 'Points must be between 1 and 1,000,000';
  end if;
  if p_request_id is null then raise exception 'Request ID required'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 300 then
    raise exception 'Enter a reason (up to 300 characters)';
  end if;
  select array_agg(x order by x) into unique_ids
  from (select distinct unnest(coalesce(p_customer_ids, '{}'::uuid[])) as x) ids;
  if coalesce(array_length(unique_ids,1),0) not between 1 and 1000 then
    raise exception 'Select between 1 and 1,000 customers';
  end if;
  insert into public.admin_customer_point_grant_batches(request_id,customer_ids,points,created_by,reason)
  values(p_request_id,unique_ids,p_points,p_created_by,trim(p_reason))
  on conflict(request_id) do nothing;
  select * into batch_row from public.admin_customer_point_grant_batches where request_id=p_request_id for update;
  if batch_row.customer_ids<>unique_ids or batch_row.points<>p_points or batch_row.created_by<>p_created_by or batch_row.reason<>trim(p_reason) then
    raise exception 'Request ID already used with different grant details';
  end if;

  -- Lock in stable order and credit only once per customer/request.
  foreach v_customer_id in array unique_ids loop
    perform 1 from public.customers where id=v_customer_id for update;
    if not found then raise exception 'Customer not found: %', v_customer_id; end if;

    select * into grant_row
    from public.admin_customer_point_grants g
    where g.customer_id=v_customer_id and g.request_id=p_request_id for update;
    if found then
      if grant_row.points<>p_points or grant_row.created_by<>p_created_by or grant_row.reason<>trim(p_reason) then
        raise exception 'Request ID already used with different grant details';
      end if;
      continue;
    end if;

    insert into public.admin_customer_point_grants(customer_id,points,request_id,created_by,reason)
    values(v_customer_id,p_points,p_request_id,p_created_by,trim(p_reason));
    update public.customers set reward_points=coalesce(reward_points,0)+p_points where id=v_customer_id;
    update public.customer_merchants set reward_points=coalesce(reward_points,0)+p_points where customer_id=v_customer_id;
    awarded_ids := array_append(awarded_ids, v_customer_id);
  end loop;
  return jsonb_build_object('awardedCustomerIds',awarded_ids,'awardedCount',coalesce(array_length(awarded_ids,1),0),'pointsPerCustomer',p_points);
end;
$$;
revoke all on function public.admin_grant_customer_points(uuid[],integer,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_grant_customer_points(uuid[],integer,uuid,uuid,text) to service_role;

notify pgrst, 'reload schema';
commit;
