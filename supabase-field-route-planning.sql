begin;
create table if not exists public.field_route_plans (
 id uuid primary key default gen_random_uuid(),
 manager_id uuid not null references public.profiles(id),
 work_date date not null,
 route_name text not null check(route_name in ('Chittur 1','Chittur 2','Chittur 3','Thathamangalam 1','Thathamangalam 2','Thathamangalam 3')),
 selected_at timestamptz not null default now(),
 unique(manager_id,work_date)
);
alter table public.field_route_plans enable row level security;
revoke all on public.field_route_plans from anon, authenticated;
grant all on public.field_route_plans to service_role;
commit;
