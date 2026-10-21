-- Additive migration. Apply after supabase-expenses.sql; rerun this after any v1 RPC reinstall.
-- Requests record desired payment dates, not guaranteed payment or automatic transfers.
begin;
alter table public.expense_claims add column if not exists claim_type text not null default 'expense';
alter table public.expense_claims add column if not exists requested_on date;
alter table public.expense_claims add column if not exists needed_by date;
alter table public.expense_claims drop constraint if exists expense_claims_request_dates;
alter table public.expense_claims add constraint expense_claims_request_dates check (
 (claim_type='expense' and requested_on is null and needed_by is null) or
 (claim_type='money_request' and requested_on is not null and needed_by is not null and needed_by>=requested_on)
);
create index if not exists expense_claims_needed_by on public.expense_claims(needed_by) where claim_type='money_request';
-- Retain the existing transactional ownership, state, audit and replay implementation.
do $$ begin
 if to_regprocedure('public.expense_action_base_v1(uuid,uuid,text,jsonb,uuid,integer)') is null then
  alter function public.expense_action(uuid,uuid,text,jsonb,uuid,integer) rename to expense_action_base_v1;
 end if;
end $$;
revoke all on function public.expense_action_base_v1(uuid,uuid,text,jsonb,uuid,integer) from public,anon,authenticated,service_role;
create or replace function public.expense_action(p_actor uuid,p_claim uuid,p_action text,p_payload jsonb,p_request uuid,p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare answer jsonb; c public.expense_claims%rowtype; kind text; on_date date; due_date date;
begin
 if p_action not in ('create','save') then
  return public.expense_action_base_v1(p_actor,p_claim,p_action,p_payload,p_request,p_version);
 end if;
 kind:=coalesce(p_payload->>'claim_type','expense');
 if kind not in ('expense','money_request') then raise exception 'Invalid request type'; end if;
 if kind='money_request' then
  -- Request date is assigned by the database and cannot be backdated by a browser.
  select * into c from public.expense_claims where id=p_claim;
  on_date:=coalesce(c.requested_on,(now() at time zone 'Asia/Kolkata')::date);
  due_date:=(p_payload->>'needed_by')::date;
  if due_date is null or due_date<on_date then raise exception 'Money needed by date must not precede request date'; end if;
  p_payload:=p_payload||jsonb_build_object('requested_on',on_date,'expense_date',on_date);
 end if;
 answer:=public.expense_action_base_v1(p_actor,p_claim,p_action,p_payload,p_request,p_version);
 if coalesce((answer->>'replayed')::boolean,false) then return answer; end if;
 update public.expense_claims set claim_type=kind,requested_on=case when kind='money_request' then on_date end,needed_by=case when kind='money_request' then due_date end where id=p_claim returning * into c;
 answer:=jsonb_set(answer,'{claim}',to_jsonb(c));
 update public.expense_audit set snapshot=jsonb_set(snapshot,'{claim}',to_jsonb(c)) where claim_id=p_claim and actor_id=p_actor and action=p_action and (snapshot->'claim'->>'version')::integer=c.version;
 update public.expense_requests set result=answer where actor_id=p_actor and request_id=p_request;
 return answer;
end $$;
revoke all on function public.expense_action(uuid,uuid,text,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.expense_action(uuid,uuid,text,jsonb,uuid,integer) to service_role;
commit;
