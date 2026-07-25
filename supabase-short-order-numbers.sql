-- Apply once in Supabase SQL Editor.
-- Existing order references are preserved. New orders use AE001, AE002, ...

begin;

create sequence if not exists public.order_number_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  cache 1;

do $$
declare
  v_existing_max bigint;
  v_sequence_last bigint;
  v_sequence_called boolean;
begin
  select coalesce(max(substring(o.order_no from 3)::bigint), 0)
  into v_existing_max
  from public.orders as o
  where o.order_no ~ '^AE[0-9]+$';

  select s.last_value, s.is_called
  into v_sequence_last, v_sequence_called
  from public.order_number_seq as s;

  if v_existing_max > 0
    and (not v_sequence_called or v_existing_max > v_sequence_last) then
    perform setval(
      'public.order_number_seq'::regclass,
      greatest(v_existing_max, v_sequence_last),
      true
    );
  end if;
end;
$$;

create or replace function public.assign_short_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_number bigint;
begin
  v_order_number := nextval('public.order_number_seq'::regclass);
  new.order_no := 'AE' || lpad(
    v_order_number::text,
    greatest(3, length(v_order_number::text)),
    '0'
  );
  return new;
end;
$$;

revoke all on function public.assign_short_order_number() from public;

drop trigger if exists orders_short_number_trigger on public.orders;
create trigger orders_short_number_trigger
before insert on public.orders
for each row
execute function public.assign_short_order_number();

commit;
