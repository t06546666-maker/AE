-- Field Manager web module. Run once in Supabase SQL editor.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','merchant','customer','field_manager'));
alter table public.profiles drop constraint if exists merchant_role_assignment;
alter table public.profiles add constraint merchant_role_assignment check (
  (role in ('admin', 'customer', 'field_manager') and merchant_id is null)
  or (role = 'merchant' and merchant_id is not null)
);
alter table public.merchants add column if not exists image_url text;
alter table public.merchants add column if not exists images jsonb default '[]'::jsonb;

create table if not exists public.field_manager_sessions (
  id uuid primary key default gen_random_uuid(), manager_id uuid not null references public.profiles(id) on delete cascade,
  login_at timestamptz not null default now(), logout_at timestamptz, login_ip text, user_agent text
);
create table if not exists public.field_manager_visits (
  id uuid primary key default gen_random_uuid(), manager_id uuid not null references public.profiles(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade, session_id uuid references public.field_manager_sessions(id) on delete set null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  check_in_at timestamptz not null default now(), check_out_at timestamptz,
  check_in_latitude numeric, check_in_longitude numeric, check_out_latitude numeric, check_out_longitude numeric,
  accuracy_m numeric, distance_m numeric, notes text, photos jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.field_manager_merchant_updates (
  id uuid primary key default gen_random_uuid(), manager_id uuid not null references public.profiles(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade, visit_id uuid references public.field_manager_visits(id) on delete set null,
  payload jsonb not null, status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text, reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists field_manager_visits_manager_idx on public.field_manager_visits(manager_id, created_at desc);
create index if not exists field_manager_visits_merchant_idx on public.field_manager_visits(merchant_id, created_at desc);
create index if not exists field_manager_updates_status_idx on public.field_manager_merchant_updates(status, created_at desc);
create or replace function public.cleanup_field_manager_visits() returns void language sql security definer as $$
  delete from public.field_manager_visits where created_at < now() - interval '90 days';
$$;
