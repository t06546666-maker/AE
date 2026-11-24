-- Reversible removal from active business; retain admin details and history.
begin;
create or replace function public.admin_archive_merchant(p_admin uuid,p_merchant uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='admin') then
  raise exception 'Admin access required' using errcode='42501';
 end if;
 perform 1 from public.merchants where id=p_merchant for update;
 if not found then raise exception 'Merchant not found' using errcode='P0002'; end if;
 update public.merchants set deleted_at=coalesce(deleted_at,now()),deleted_by=coalesce(deleted_by,p_admin) where id=p_merchant;
 update public.offers set status='rejected' where merchant_id=p_merchant;
end $$;
revoke all on function public.admin_archive_merchant(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_archive_merchant(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
