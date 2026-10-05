begin;
alter table public.merchants add column if not exists route_name text;
alter table public.merchants drop constraint if exists merchants_route_name_check;
alter table public.merchants add constraint merchants_route_name_check
  check (route_name is null or route_name in ('Chittur 1', 'Chittur 2', 'Chittur 3', 'Thathamangalam 1', 'Thathamangalam 2', 'Thathamangalam 3'));
commit;
