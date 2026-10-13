-- Apply in Supabase SQL Editor before deploying prorated reward previews.
-- Updates future purchases only; historical orders and balances are unchanged.
begin;
do $$
declare fn record; definition text; updated text; rate_name text; changed_count integer := 0;
begin
  for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='process_purchase' and p.prokind='f'
  loop
    definition := pg_get_functiondef(fn.oid);
    if position('AE_PRORATED_PURCHASE_POINTS' in definition)>0 then changed_count:=changed_count+1; continue; end if;
    if definition !~* 'v_points[[:space:]]+numeric' or definition !~* 'insert[[:space:]]+into[[:space:]]+(public\.)?orders[[:space:]]*\(' then
      raise exception 'Unsupported purchase function %. Expected numeric points; no changes committed.',fn.oid::regprocedure;
    end if;
    if position('p_points_per_100' in definition)>0 then rate_name:='p_points_per_100';
    elsif position('p_reward_percentage' in definition)>0 then rate_name:='p_reward_percentage';
    else raise exception 'No recognized reward rate in %',fn.oid::regprocedure; end if;
    updated := regexp_replace(definition,'(insert[[:space:]]+into[[:space:]]+(public\.)?orders[[:space:]]*\()',
      E'/* AE_PRORATED_PURCHASE_POINTS */\n if p_amount >= 100 then\n v_points := least(100, greatest(0, round(p_amount * ' || rate_name || E' / 100.0, 2)));\n end if;\n \\1','i');
    execute updated;
    changed_count:=changed_count+1;
  end loop;
  if changed_count=0 then raise exception 'No process_purchase function found'; end if;
end $$;
notify pgrst,'reload schema';
commit;
