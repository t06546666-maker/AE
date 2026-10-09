-- Maximum 100 issued points per purchase. Existing transactions are not changed.
-- Preserves the installed process_purchase signatures, rates and return columns.
begin;
do $$
declare fn record; definition text; updated text; found_count integer := 0;
begin
  for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='process_purchase' and p.prokind='f'
  loop
    definition := pg_get_functiondef(fn.oid);
    if position('AE_PURCHASE_POINTS_CAP' in definition)>0 then
      found_count := found_count+1;
      continue;
    end if;
    if definition !~* 'v_points[[:space:]]+(numeric|integer)' or definition !~* 'insert[[:space:]]+into[[:space:]]+(public\.)?orders[[:space:]]*\(' then
      raise exception 'Unrecognized process_purchase definition (%). No changes applied.', fn.oid::regprocedure;
    end if;
    -- Cap the local value BEFORE order insertion, merchant debits and balance credits.
    updated := regexp_replace(definition,
      '(insert[[:space:]]+into[[:space:]]+(public\.)?orders[[:space:]]*\()',
      E'/* AE_PURCHASE_POINTS_CAP */\n  v_points := least(100, greatest(0, v_points));\n  \\1', 'i');
    if updated=definition then raise exception 'Could not apply purchase points cap'; end if;
    execute updated;
    found_count := found_count+1;
  end loop;
  if found_count=0 then raise exception 'No process_purchase function found. No changes applied.'; end if;
end $$;
-- Guard other purchase writers too, without blocking status updates to old records.
create or replace function public.guard_purchase_points_cap() returns trigger
language plpgsql set search_path=public as $$
begin
  if TG_OP='UPDATE' and NEW.reward_points is not distinct from OLD.reward_points then return NEW; end if;
  if NEW.reward_points is null or NEW.reward_points<0 or NEW.reward_points>100 then
    raise exception 'A purchase may issue between 0 and 100 AE Points only';
  end if;
  return NEW;
end $$;
drop trigger if exists orders_guard_points_cap on public.orders;
create trigger orders_guard_points_cap before insert or update of reward_points on public.orders
for each row execute function public.guard_purchase_points_cap();
commit;

-- Verify the cap is present in every installed purchase function.
select p.oid::regprocedure as purchase_function,
  position('AE_PURCHASE_POINTS_CAP' in pg_get_functiondef(p.oid))>0 as cap_installed
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='process_purchase' and p.prokind='f';
