begin;
create table if not exists public.field_attendance (
 id uuid primary key default gen_random_uuid(),
 manager_id uuid not null references public.profiles(id),
 work_date date not null,
 started_at timestamptz not null default now(), ended_at timestamptz,
 selfie text not null,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy_m double precision not null check(accuracy_m >= 0),
 unique(manager_id, work_date), check(ended_at is null or ended_at >= started_at)
);
create unique index if not exists field_attendance_one_active_day on public.field_attendance(manager_id) where ended_at is null;
create table if not exists public.field_work_requests (
 id uuid primary key default gen_random_uuid(),
 manager_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('leave','non_field')),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at > starts_at),
 reason text not null, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
alter table public.field_attendance enable row level security;
alter table public.field_work_requests enable row level security;
revoke all on public.field_attendance, public.field_work_requests from anon, authenticated;
grant all on public.field_attendance, public.field_work_requests to service_role;
commit;
