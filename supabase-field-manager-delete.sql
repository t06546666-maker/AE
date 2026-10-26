begin;
create table if not exists public.field_manager_deletion_audit (
 id uuid primary key default gen_random_uuid(),
 admin_id uuid not null references public.profiles(id),
 deleted_manager_id uuid not null,
 reason text not null check(length(trim(reason)) between 5 and 2000),
 deleted_at timestamptz not null default now()
);
alter table public.field_manager_deletion_audit enable row level security;
revoke all on public.field_manager_deletion_audit from anon,authenticated;
grant select,insert on public.field_manager_deletion_audit to service_role;
create or replace function public.admin_delete_field_manager(p_admin uuid,p_manager uuid,p_reason text)
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_finance boolean:=false;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='admin') then
  raise exception 'Admin access required' using errcode='42501';
 end if;
 if p_reason is null or length(trim(p_reason)) not between 5 and 2000 then
  raise exception 'Deletion reason required' using errcode='22023';
 end if;
 perform 1 from public.profiles where id=p_manager and role='field_manager' for update;
 if not found then raise exception 'Field manager not found' using errcode='P0002'; end if;
 -- Never erase claims, payment records or financial audit history.
 if to_regclass('public.expense_claims') is not null then
  execute 'select exists(select 1 from public.expense_claims where owner_id=$1 or reviewed_by=$1 or paid_by=$1)' into v_finance using p_manager;
  if v_finance then raise exception 'Financial records prevent permanent deletion. No account data was deleted.' using errcode='23503'; end if;
 end if;
 if to_regclass('public.expense_audit') is not null then
  execute 'select exists(select 1 from public.expense_audit where actor_id=$1)' into v_finance using p_manager;
  if v_finance then raise exception 'Financial audit records prevent permanent deletion.' using errcode='23503'; end if;
 end if;
 if to_regclass('public.field_attendance_admin_audit') is not null then
  execute 'delete from public.field_attendance_admin_audit where manager_id=$1' using p_manager;
 end if;
 if to_regclass('public.field_attendance') is not null then
  execute 'delete from public.field_attendance where manager_id=$1' using p_manager;
 end if;
 if to_regclass('public.field_work_requests') is not null then
  execute 'delete from public.field_work_requests where manager_id=$1' using p_manager;
 end if;
 if to_regclass('public.field_route_plans') is not null then
  execute 'delete from public.field_route_plans where manager_id=$1' using p_manager;
 end if;
 if to_regclass('public.field_manager_activity') is not null then
  execute 'delete from public.field_manager_activity where manager_id=$1' using p_manager;
 end if;
 if to_regclass('public.expense_members') is not null then
  execute 'delete from public.expense_members where profile_id=$1' using p_manager;
 end if;
 -- FKs cascade this manager's visits, sessions, updates and latest location.
 -- Any unexpected restriction aborts and rolls back ALL earlier deletes.
 delete from auth.users where id=p_manager;
 delete from public.profiles where id=p_manager;
 insert into public.field_manager_deletion_audit(admin_id,deleted_manager_id,reason)
  values(p_admin,p_manager,trim(p_reason));
 return jsonb_build_object('deleted',true,'managerId',p_manager);
end $$;
revoke all on function public.admin_delete_field_manager(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_delete_field_manager(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
