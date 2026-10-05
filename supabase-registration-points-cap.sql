-- process_purchase in supabase-rewards-engine-update.sql already calculates
-- least(100, floor(eligible purchase / 100) * points per 100).
-- Apply this additional guard to reject over-cap registration awards from any
-- older RPC or direct database writes. NOT VALID preserves historical orders.
begin;
alter table public.orders drop constraint if exists registration_points_maximum;
alter table public.orders add constraint registration_points_maximum
  check (source is distinct from 'registration' or reward_points <= 100) not valid;
commit;
