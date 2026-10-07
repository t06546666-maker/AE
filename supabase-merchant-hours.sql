begin;
alter table public.merchants add column if not exists opening_time time;
alter table public.merchants add column if not exists closing_time time;
commit;
