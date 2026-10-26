-- Install only. This script does not delete any merchant.
begin;
alter table public.field_manager_activity
 add column if not exists merchant_name_snapshot text,
 add column if not exists merchant_code_snapshot text,
 add column if not exists deleted_merchant_id uuid;
alter table public.field_manager_activity alter column merchant_id drop not null;
alter table public.field_manager_activity drop constraint if exists field_manager_activity_merchant_id_fkey;
alter table public.field_manager_activity add constraint field_manager_activity_merchant_id_fkey
 foreign key(merchant_id) references public.merchants(id) on delete set null;
create table if not exists public.merchant_deletion_audit (
 id uuid primary key default gen_random_uuid(), admin_id uuid not null references public.profiles(id),
 merchant_id uuid not null, merchant_name text not null, created_at timestamptz not null default now()
);
alter table public.merchant_deletion_audit enable row level security;
revoke all on public.merchant_deletion_audit from public,anon,authenticated;
grant select,insert on public.merchant_deletion_audit to service_role;
create or replace function public.admin_delete_unused_merchant(p_admin uuid,p_merchant uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.merchants; link record; linked boolean; account record;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='admin') then
  raise exception 'Admin access required' using errcode='42501'; end if;
 select * into m from public.merchants where id=p_merchant for update;
 if not found then raise exception 'Merchant not found' using errcode='P0002'; end if;
 -- Protect every linked business row, including links whose FK would cascade.
 for link in
  select c.conrelid::regclass as tbl,a.attname as col,array_length(c.conkey,1) as keys
  from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
  where c.contype='f' and c.confrelid='public.merchants'::regclass
   and c.conrelid not in ('public.profiles'::regclass,'public.field_manager_activity'::regclass)
 loop
  if link.keys<>1 then raise exception 'Protected composite reference' using errcode='23503'; end if;
  execute format('select exists(select 1 from %s where %I=$1)',link.tbl,link.col) into linked using p_merchant;
  if linked then raise exception 'Merchant has protected linked records' using errcode='23503'; end if;
 end loop;
 for account in select id,role from public.profiles where merchant_id=p_merchant for update loop
  if account.role<>'merchant' then raise exception 'Protected profile linked' using errcode='23503'; end if;
  for link in
   select c.conrelid::regclass as tbl,a.attname as col,array_length(c.conkey,1) as keys
   from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
   where c.contype='f' and (c.confrelid='public.profiles'::regclass
     or (c.confrelid='auth.users'::regclass and c.connamespace='public'::regnamespace and c.conrelid<>'public.profiles'::regclass))
  loop
   if link.keys<>1 then raise exception 'Protected composite reference' using errcode='23503'; end if;
   execute format('select exists(select 1 from %s where %I=$1)',link.tbl,link.col) into linked using account.id;
   if linked then raise exception 'Merchant login has protected linked records' using errcode='23503'; end if;
  end loop;
 end loop;
 update public.field_manager_activity set merchant_name_snapshot=m.name,
  merchant_code_snapshot=m.merchant_code,deleted_merchant_id=p_merchant where merchant_id=p_merchant;
 delete from auth.users where id in (select id from public.profiles where merchant_id=p_merchant and role='merchant');
 delete from public.profiles where merchant_id=p_merchant and role='merchant';
 delete from public.merchants where id=p_merchant;
 insert into public.merchant_deletion_audit(admin_id,merchant_id,merchant_name) values(p_admin,p_merchant,m.name);
end $$;
revoke all on function public.admin_delete_unused_merchant(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_unused_merchant(uuid,uuid) to service_role;
commit;
