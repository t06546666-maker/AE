create table if not exists public.app_settings (
  key text primary key,
  value numeric not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('reward_percentage', 1)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "staff read settings" on public.app_settings;
create policy "staff read settings" on public.app_settings for select
using (public.current_profile_role() in ('admin', 'merchant'));

drop policy if exists "admins manage settings" on public.app_settings;
create policy "admins manage settings" on public.app_settings for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');
