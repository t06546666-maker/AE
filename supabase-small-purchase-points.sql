-- Run in Supabase SQL Editor. Does not alter historical purchases or balances.
begin;
do $$
declare fn record; definition text; updated text; found_count integer:=0;
begin
  for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='process_purchase' and p.prokind='f'
  loop
    definition:=pg_get_functiondef(fn.oid);
    if position('AE_SMALL_PURCHASE_POINTS' in definition)>0 then found_count:=found_count+1;continue;end if;
    if definition !~* 'v_points[[:space:]]+(numeric|integer)' or definition !~* 'p_amount' or definition !~* 'insert[[:space:]]+into[[:space:]]+(public\.)?orders[[:space:]]*\(' then
      raise exception 'Unrecognized process_purchase definition: %. Nothing changed.',fn.oid::regprocedure;
    end if;
    updated:=regexp_replace(definition,'if[[:space:]]+p_amount[[:space:]]*<[[:space:]]*(100|10)[[:space:]]+then','if p_amount < 1 then','gi');
    updated:=regexp_replace(updated,'Minimum purchase amount is (100|10)','Minimum purchase amount is 1','gi');
    updated:=regexp_replace(updated,'(insert[[:space:]]+into[[:space:]]+(public\.)?orders[[:space:]]*\()',
      E'/* AE_SMALL_PURCHASE_POINTS */\n if p_amount >= 1 and p_amount < 10 then v_points := 1;\n elsif p_amount >= 10 and p_amount < 50 then v_points := 2;\n elsif p_amount >= 50 and p_amount < 100 then v_points := 5; end if;\n v_points := least(100,greatest(0,v_points));\n \\1','i');
    if updated=definition then raise exception 'Could not update purchase function';end if;
    execute updated;found_count:=found_count+1;
  end loop;
  if found_count=0 then raise exception 'No process_purchase function found. Nothing changed.';end if;
end $$;
-- Only replace the known standalone minimum-amount constraint, if present.
do $$ declare item record; begin
 for item in select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.orders'::regclass and contype='c'
 loop
  if item.definition ~ '^CHECK \(\(amount >= \((100|10)\)::numeric\)\)$' then
   execute format('alter table public.orders drop constraint %I',item.conname);
   execute format('alter table public.orders add constraint %I check (amount >= 1) not valid',item.conname);
  end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
