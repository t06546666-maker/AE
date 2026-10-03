create table if not exists public.field_manager_activity (
 id uuid primary key default gen_random_uuid(),
 manager_id uuid not null references public.profiles(id),
 merchant_id uuid not null references public.merchants(id),
 action text not null check(action = 'merchant_profile_view'),
 created_at timestamptz not null default now()
);
alter table public.field_manager_activity enable row level security;
revoke all on public.field_manager_activity from anon, authenticated;
grant select, insert on public.field_manager_activity to service_role;
create index if not exists field_activity_manager_time on public.field_manager_activity(manager_id, created_at desc);
