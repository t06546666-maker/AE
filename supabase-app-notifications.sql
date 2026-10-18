-- Run once in Supabase SQL Editor before deploying the app notification inbox.
-- All reads/writes are made by the authenticated server using the service role.
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) <= 160),
  body text not null check (char_length(body) <= 1000),
  target_url text check (target_url is null or (left(target_url, 1) = '/' and left(target_url, 2) <> '//')),
  event_type text not null default 'general' check (char_length(event_type) <= 80),
  entity_id text check (entity_id is null or char_length(entity_id) <= 160),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_notifications_profile_created_idx
  on public.app_notifications (profile_id, created_at desc);

create index if not exists app_notifications_profile_unread_idx
  on public.app_notifications (profile_id, created_at desc)
  where read_at is null;

alter table public.app_notifications enable row level security;

-- No client policies: notification rows are accessed only by the server's
-- Supabase service-role client, which bypasses RLS.
