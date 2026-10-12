begin;
-- Latest location only, not a route history. Backend authenticates actor and active attendance.
create table if not exists public.field_manager_locations (
 manager_id uuid primary key references public.profiles(id) on delete cascade,
 attendance_id uuid not null references public.field_attendance(id) on delete cascade,
 latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180),
 accuracy_m double precision not null check (accuracy_m between 0 and 100000),
 captured_at timestamptz not null,
 updated_at timestamptz not null default now(),
 sharing boolean not null default true
);
alter table public.field_manager_locations enable row level security;
revoke all on public.field_manager_locations from anon, authenticated;
grant all on public.field_manager_locations to service_role;
commit;
