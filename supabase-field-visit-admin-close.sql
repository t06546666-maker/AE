begin;
alter table public.field_manager_visits add column if not exists admin_closed_by uuid references public.profiles(id);
alter table public.field_manager_visits add column if not exists admin_closed_at timestamptz;
alter table public.field_manager_visits add column if not exists admin_close_reason text;
commit;
