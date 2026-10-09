-- Apply after supabase-merchant-point-allocation.sql.
-- Start an auditable balance history without guessing historical opening balances.
begin;
lock table public.merchants in share row exclusive mode;
create table if not exists public.merchant_point_balance_history (
  id bigint generated always as identity primary key,
  merchant_id uuid not null references public.merchants(id),
  balance numeric not null,
  change numeric not null,
  recorded_at timestamptz not null default clock_timestamp()
);
alter table public.merchant_point_balance_history enable row level security;
revoke all on public.merchant_point_balance_history from anon, authenticated;
grant all on public.merchant_point_balance_history to service_role;
create index if not exists merchant_point_history_lookup on public.merchant_point_balance_history(merchant_id, recorded_at);
insert into public.merchant_point_balance_history(merchant_id,balance,change)
select id,point_balance,0 from public.merchants m where not exists(select 1 from public.merchant_point_balance_history h where h.merchant_id=m.id);
create or replace function public.record_merchant_point_balance() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into merchant_point_balance_history(merchant_id,balance,change)
  values(NEW.id,NEW.point_balance,case when TG_OP='INSERT' then 0 else NEW.point_balance-OLD.point_balance end);
  return NEW;
end $$;
drop trigger if exists merchant_point_balance_history_trigger on public.merchants;
create trigger merchant_point_balance_history_trigger after insert or update of point_balance on public.merchants for each row execute function public.record_merchant_point_balance();
revoke all on function public.record_merchant_point_balance() from public,anon,authenticated;
create or replace function public.merchant_point_insights(p_merchant_id uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
 'balance',(select point_balance from merchants where id=p_merchant_id),
 'carriedForward',(select balance from merchant_point_balance_history where merchant_id=p_merchant_id and recorded_at < (date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') order by recorded_at desc,id desc limit 1),
 'events',coalesce((select jsonb_agg(e order by e->>'timestamp') from (
 select jsonb_build_object('timestamp',created_at,'issued',greatest(coalesce(reward_points,0),0),'redeemed',0) e from orders where merchant_id=p_merchant_id and created_at>=p_from and created_at<p_to and created_at<=now()
 union all select jsonb_build_object('timestamp',created_at,'issued',points,'redeemed',0) from loyalty_bonuses where merchant_id=p_merchant_id and created_at>=p_from and created_at<p_to and created_at<=now()
 union all select jsonb_build_object('timestamp',created_at,'issued',0,'redeemed',points_redeemed) from point_redemptions where merchant_id=p_merchant_id and created_at>=p_from and created_at<p_to and created_at<=now()
 ) entries),'[]'::jsonb));
$$;
revoke all on function public.merchant_point_insights(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.merchant_point_insights(uuid,timestamptz,timestamptz) to service_role;
commit;
