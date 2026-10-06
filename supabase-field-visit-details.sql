begin;
alter table public.field_manager_visits add column if not exists outcome text;
alter table public.field_manager_visits add column if not exists follow_up_date date;
alter table public.field_manager_visits add column if not exists problems text;
alter table public.field_manager_visits add column if not exists feedback text;
commit;
