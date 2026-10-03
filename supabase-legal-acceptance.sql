-- Run in Supabase SQL Editor before enabling LEGAL_ACCEPTANCE_ENABLED.
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  actor_role text not null check (actor_role in ('customer','merchant','field_manager')),
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  unique(actor_id, actor_role, terms_version, privacy_version)
);
alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from anon, authenticated;
grant select, insert on public.legal_acceptances to service_role;
