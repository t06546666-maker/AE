-- Installs removal capability only. Does not remove any existing merchant.
begin;
alter table public.merchants add column if not exists deleted_at timestamptz;
alter table public.merchants add column if not exists deleted_by uuid;
create or replace view public.active_merchants with (security_invoker=true) as
 select * from public.merchants where deleted_at is null with local check option;
revoke all on public.active_merchants from public,anon,authenticated;
grant select,insert,update,delete on public.active_merchants to service_role;
create table if not exists public.merchant_removal_jobs (
 merchant_id uuid primary key references public.merchants(id),
 profile_ids uuid[] not null default '{}', image_urls text[] not null default '{}',
 completed_at timestamptz, created_at timestamptz not null default now()
);
alter table public.merchant_removal_jobs enable row level security;
revoke all on public.merchant_removal_jobs from public,anon,authenticated;
grant select,insert,update on public.merchant_removal_jobs to service_role;
-- Customer bonus history survives removal of the merchant who awarded it.
do $$ declare fk record; begin
 for fk in select c.conname from pg_constraint c join pg_attribute a
 on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
 where c.contype='f' and c.conrelid='public.loyalty_bonuses'::regclass
 and c.confrelid='public.profiles'::regclass and a.attname='created_by'
 loop execute format('alter table public.loyalty_bonuses drop constraint %I',fk.conname); end loop;
 alter table public.loyalty_bonuses alter column created_by drop not null;
 alter table public.loyalty_bonuses add constraint loyalty_bonuses_created_by_fkey
 foreign key(created_by) references public.profiles(id) on delete set null;
end $$;
create or replace function public.admin_remove_merchant(p_admin uuid,p_merchant uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.merchants; accounts uuid[]; images_to_remove text[]; 
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='admin') then
  raise exception 'Admin access required' using errcode='42501'; end if;
 select * into m from public.merchants where id=p_merchant for update;
 if not found then raise exception 'Merchant not found' using errcode='P0002'; end if;
 if m.deleted_at is not null then return jsonb_build_object('removed',true,'alreadyRemoved',true); end if;
 if exists(select 1 from public.profiles where merchant_id=p_merchant and role<>'merchant') then
  raise exception 'Non-merchant account linked to shop' using errcode='23503'; end if;
 select coalesce(array_agg(id),'{}'::uuid[]) into accounts from public.profiles where merchant_id=p_merchant and role='merchant';
 select coalesce(array_agg(distinct u),'{}'::text[]) into images_to_remove
 from (select jsonb_array_elements_text(coalesce(m.images,'[]'::jsonb)) as u union all select m.image_url) urls where u is not null;
 -- Keep customer records and all their financial/points history, including
 -- funding identifiers required for future redemptions and settlement.
 -- The base merchant row becomes an irreversible, non-login history reference.
 -- Delete only operational records that belong solely to this merchant.
 delete from public.merchant_notifications where merchant_id=p_merchant;
 delete from public.products where merchant_id=p_merchant;
 delete from public.offer_campaigns where merchant_id=p_merchant;
 delete from public.offers where merchant_id=p_merchant;
 delete from public.reward_rules where merchant_id=p_merchant;
 delete from public.field_manager_merchant_updates where merchant_id=p_merchant;
 delete from public.field_manager_visits where merchant_id=p_merchant;
 update public.field_manager_activity set merchant_name_snapshot='Deleted merchant',
  merchant_code_snapshot=null,deleted_merchant_id=p_merchant,merchant_id=null where merchant_id=p_merchant;
 -- User deletion cascades to the merchant profile. Restrictive references cause
 -- the entire operation to roll back; never erase customer/finance records.
 delete from auth.users where id=any(accounts);
 delete from public.profiles where id=any(accounts);
 update public.merchants set name='Deleted merchant',email='deleted-'||id::text||'@removed.invalid',
  phone='',merchant_code='DEL-'||id::text,category_id=null,address=null,latitude=null,longitude=null,
  image_url=null,images='[]'::jsonb,route_name=null,opening_time=null,closing_time=null,
  bank_details='{}',subscription_expires_at=null,subscription_mandate_id=null,
  reward_rate_bps=0,earn_points_per_100=0,redeem_discount_per_100=0,
  deleted_at=now(),deleted_by=p_admin where id=p_merchant;
 insert into public.merchant_removal_jobs(merchant_id,profile_ids,image_urls) values(p_merchant,accounts,images_to_remove);
 insert into public.merchant_deletion_audit(admin_id,merchant_id,merchant_name) values(p_admin,p_merchant,'Deleted merchant');
 return jsonb_build_object('removed',true,'alreadyRemoved',false);
end $$;
revoke all on function public.admin_remove_merchant(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_remove_merchant(uuid,uuid) to service_role;
-- Prevent old SQL clients from creating new business at a removed shop.
create or replace function public.reject_removed_merchant_business()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.merchants where id=new.merchant_id and deleted_at is not null) then
  raise exception 'Shop is no longer available' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists reject_removed_merchant_order on public.orders;
create trigger reject_removed_merchant_order before insert on public.orders for each row execute function public.reject_removed_merchant_business();
drop trigger if exists reject_removed_merchant_customer_order on public.customer_orders;
create trigger reject_removed_merchant_customer_order before insert on public.customer_orders for each row execute function public.reject_removed_merchant_business();
notify pgrst,'reload schema';
commit;
