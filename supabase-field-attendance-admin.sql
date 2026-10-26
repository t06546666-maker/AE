begin;
alter table public.field_attendance
 add column if not exists admin_started_by uuid references public.profiles(id),
 add column if not exists admin_started_at timestamptz,
 add column if not exists admin_start_reason text,
 add column if not exists admin_ended_by uuid references public.profiles(id),
 add column if not exists admin_ended_at timestamptz,
 add column if not exists admin_end_reason text;
alter table public.field_attendance alter column selfie drop not null,
 alter column latitude drop not null, alter column longitude drop not null,
 alter column accuracy_m drop not null;
alter table public.field_attendance drop constraint if exists field_attendance_capture_or_admin;
alter table public.field_attendance add constraint field_attendance_capture_or_admin check (
 (admin_started_by is not null and admin_started_at is not null and length(trim(admin_start_reason))>=5)
 or (selfie is not null and latitude is not null and longitude is not null and accuracy_m is not null)
);
create table if not exists public.field_attendance_admin_audit (
 id uuid primary key default gen_random_uuid(),
 attendance_id uuid not null references public.field_attendance(id),
 manager_id uuid not null references public.profiles(id),
 admin_id uuid not null references public.profiles(id),
 action text not null check(action in ('start','end')),
 reason text not null check(length(trim(reason)) between 5 and 2000),
 created_at timestamptz not null default now(),
 unique(attendance_id,action)
);
alter table public.field_attendance_admin_audit enable row level security;
revoke all on public.field_attendance_admin_audit from anon,authenticated;
grant select,insert on public.field_attendance_admin_audit to service_role;
create or replace function public.admin_field_attendance_action(
 p_admin uuid,p_manager uuid,p_action text,p_reason text,p_attendance uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row public.field_attendance; v_now timestamptz:=statement_timestamp(); v_day date:=(statement_timestamp() at time zone 'Asia/Kolkata')::date;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='admin') then
  raise exception 'Admin access required' using errcode='42501';
 end if;
 if p_action not in ('start','end') or p_action is null or p_reason is null or length(trim(p_reason)) not between 5 and 2000 then
  raise exception 'A valid action and reason are required' using errcode='22023';
 end if;
 -- Serialize overrides for this manager. Unique indexes also protect normal starts.
 perform 1 from public.profiles where id=p_manager and role='field_manager' for update;
 if not found then raise exception 'Field manager not found' using errcode='P0002'; end if;
 if p_action='start' then
  if exists(select 1 from public.field_attendance where manager_id=p_manager and (work_date=v_day or ended_at is null)) then
   raise exception 'Attendance already exists for today or an earlier day is still active' using errcode='23505';
  end if;
  insert into public.field_attendance(manager_id,work_date,started_at,admin_started_by,admin_started_at,admin_start_reason)
   values(p_manager,v_day,v_now,p_admin,v_now,trim(p_reason)) returning * into v_row;
 else
  select * into v_row from public.field_attendance where id=p_attendance and manager_id=p_manager for update;
  if not found or v_row.ended_at is not null then
   raise exception 'Attendance is no longer active. Refresh before trying again.' using errcode='23505';
  end if;
  update public.field_attendance set ended_at=v_now,admin_ended_by=p_admin,admin_ended_at=v_now,admin_end_reason=trim(p_reason)
   where id=v_row.id returning * into v_row;
 end if;
 insert into public.field_attendance_admin_audit(attendance_id,manager_id,admin_id,action,reason,created_at)
  values(v_row.id,p_manager,p_admin,p_action,trim(p_reason),v_now);
 return jsonb_build_object('id',v_row.id,'work_date',v_row.work_date,'started_at',v_row.started_at,'ended_at',v_row.ended_at,
  'admin_started_by',v_row.admin_started_by,'admin_started_at',v_row.admin_started_at,'admin_start_reason',v_row.admin_start_reason,
  'admin_ended_by',v_row.admin_ended_by,'admin_ended_at',v_row.admin_ended_at,'admin_end_reason',v_row.admin_end_reason);
end $$;
revoke all on function public.admin_field_attendance_action(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_field_attendance_action(uuid,uuid,text,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
