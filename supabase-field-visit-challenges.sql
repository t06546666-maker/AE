begin;
alter table public.field_manager_visits add column if not exists reason text;
alter table public.field_manager_visits add column if not exists challenge_status text;
alter table public.field_manager_visits add column if not exists report_image text;
commit;
