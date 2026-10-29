begin;
alter table public.expense_claims drop constraint if exists expense_claims_status_check;
alter table public.expense_claims add constraint expense_claims_status_check check(status in ('draft','submitted','corrections','approved','rejected','paid','cancelled'));
create or replace function public.expense_cancel(p_actor uuid,p_claim uuid,p_request uuid,p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.expense_claims%rowtype; old public.expense_requests%rowtype; sig jsonb; answer jsonb;
begin
 if p_actor is null or p_claim is null or p_request is null or p_version is null then raise exception 'Missing request identity'; end if;
 if not exists(select 1 from public.profiles p join public.expense_members m on m.profile_id=p.id where p.id=p_actor and p.role in ('staff','field_manager') and m.active) then raise exception 'Employee access required'; end if;
 sig:=jsonb_build_object('claim',p_claim,'action','cancel','version',p_version);
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_request::text,0));
 select * into old from public.expense_requests where actor_id=p_actor and request_id=p_request;
 if found then
  if old.signature<>sig then raise exception 'Request key already used for another action'; end if;
  return old.result||jsonb_build_object('replayed',true);
 end if;
 select * into c from public.expense_claims where id=p_claim for update;
 if not found or c.owner_id<>p_actor then raise exception 'Claim not found'; end if;
 if c.version<>p_version then raise exception 'Claim changed. Refresh and retry.'; end if;
 if c.status not in ('draft','submitted') then raise exception 'Only draft or in-review claims can be cancelled'; end if;
 update public.expense_claims set status='cancelled',version=version+1,updated_at=now() where id=p_claim returning * into c;
 insert into public.expense_audit(claim_id,actor_id,action,snapshot) values(p_claim,p_actor,'cancel',jsonb_build_object('claim',to_jsonb(c)));
 answer:=jsonb_build_object('claim',to_jsonb(c),'replayed',false);
 insert into public.expense_requests(actor_id,request_id,signature,result) values(p_actor,p_request,sig,answer);
 return answer;
end $$;
revoke all on function public.expense_cancel(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.expense_cancel(uuid,uuid,uuid,integer) to service_role;
notify pgrst, 'reload schema';
commit;
