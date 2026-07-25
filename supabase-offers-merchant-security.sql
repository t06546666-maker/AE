-- Affiliate AE merchant security, offers, and WhatsApp campaign queue.
-- Safe to run more than once on an existing Supabase project.

begin;

create extension if not exists pgcrypto;

create sequence if not exists public.merchant_number_seq
  as bigint start with 1 increment by 1 minvalue 1 cache 1;

alter table public.merchants
  add column if not exists merchant_code text;

do $$
declare
  merchant_row record;
begin
  for merchant_row in
    select id
    from public.merchants
    where merchant_code is null
    order by created_at, id
  loop
    update public.merchants
    set merchant_code = 'MER' || lpad(
      nextval('public.merchant_number_seq'::regclass)::text,
      3,
      '0'
    )
    where id = merchant_row.id;
  end loop;
end;
$$;

select setval(
  'public.merchant_number_seq'::regclass,
  greatest(
    coalesce((
      select max(substring(merchant_code from '[0-9]+$')::bigint)
      from public.merchants
      where merchant_code ~ '^MER[0-9]+$'
    ), 0) + 1,
    1
  ),
  false
);

alter table public.merchants
  alter column merchant_code set not null;

create unique index if not exists merchants_merchant_code_unique
  on public.merchants(merchant_code);

create or replace function public.assign_merchant_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  merchant_number bigint;
begin
  if new.merchant_code is null or btrim(new.merchant_code) = '' then
    merchant_number := nextval('public.merchant_number_seq'::regclass);
    new.merchant_code := 'MER' || lpad(
      merchant_number::text,
      greatest(3, length(merchant_number::text)),
      '0'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.assign_merchant_code() from public;

drop trigger if exists merchants_assign_code_trigger on public.merchants;
create trigger merchants_assign_code_trigger
before insert on public.merchants
for each row
execute function public.assign_merchant_code();

alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists password_reset_at timestamptz,
  add column if not exists password_changed_at timestamptz;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 1000),
  image_path text not null,
  expires_at timestamptz not null,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected')
  ),
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  broadcast_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offer_campaigns (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'partial_failed', 'failed')
  ),
  total_recipients integer not null default 0,
  queued_count integer not null default 0,
  processing_count integer not null default 0,
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  read_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  meta_media_id text,
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.offer_campaigns
  add column if not exists processing_count integer not null default 0;

create table if not exists public.offer_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.offer_campaigns(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  recipient text not null,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped')
  ),
  attempts integer not null default 0 check (attempts between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  meta_message_id text unique,
  error_code text,
  error_message text,
  status_timestamp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

alter table public.whatsapp_messages
  add column if not exists merchant_id uuid references public.merchants(id) on delete set null,
  add column if not exists offer_id uuid references public.offers(id) on delete set null,
  add column if not exists campaign_id uuid references public.offer_campaigns(id) on delete set null,
  add column if not exists offer_recipient_id uuid references public.offer_recipients(id) on delete set null,
  add column if not exists message_type text not null default 'order';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'whatsapp_messages_message_type_check'
      and conrelid = 'public.whatsapp_messages'::regclass
  ) then
    alter table public.whatsapp_messages
      add constraint whatsapp_messages_message_type_check
      check (message_type in ('order', 'qr', 'merchant_credentials', 'offer'));
  end if;
end;
$$;

create index if not exists offers_merchant_status_created_idx
  on public.offers(merchant_id, status, created_at desc);
create index if not exists offers_status_created_idx
  on public.offers(status, created_at desc);
create index if not exists offer_campaigns_status_updated_idx
  on public.offer_campaigns(status, updated_at);
create index if not exists offer_recipients_queue_idx
  on public.offer_recipients(status, next_attempt_at, created_at)
  where status in ('queued', 'failed');
create index if not exists offer_recipients_campaign_status_idx
  on public.offer_recipients(campaign_id, status);
create index if not exists whatsapp_messages_offer_recipient_idx
  on public.whatsapp_messages(offer_recipient_id);
create index if not exists whatsapp_messages_merchant_created_idx
  on public.whatsapp_messages(merchant_id, created_at desc);

alter table public.offers enable row level security;
alter table public.offer_campaigns enable row level security;
alter table public.offer_recipients enable row level security;

drop policy if exists "staff read offers" on public.offers;
create policy "staff read offers" on public.offers for select
using (
  public.current_profile_role() = 'admin'
  or merchant_id = public.current_merchant_id()
);

drop policy if exists "merchants create offers" on public.offers;
create policy "merchants create offers" on public.offers for insert
with check (
  public.current_profile_role() = 'merchant'
  and merchant_id = public.current_merchant_id()
);

drop policy if exists "merchants update rejected offers" on public.offers;
create policy "merchants update rejected offers" on public.offers for update
using (
  public.current_profile_role() = 'merchant'
  and merchant_id = public.current_merchant_id()
  and status = 'rejected'
)
with check (
  public.current_profile_role() = 'merchant'
  and merchant_id = public.current_merchant_id()
  and status = 'pending'
);

drop policy if exists "admins manage offers" on public.offers;
create policy "admins manage offers" on public.offers for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "staff read offer campaigns" on public.offer_campaigns;
create policy "staff read offer campaigns" on public.offer_campaigns for select
using (
  public.current_profile_role() = 'admin'
  or merchant_id = public.current_merchant_id()
);

drop policy if exists "admins manage offer campaigns" on public.offer_campaigns;
create policy "admins manage offer campaigns" on public.offer_campaigns for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "staff read offer recipients" on public.offer_recipients;
create policy "staff read offer recipients" on public.offer_recipients for select
using (
  public.current_profile_role() = 'admin'
  or merchant_id = public.current_merchant_id()
);

drop policy if exists "admins manage offer recipients" on public.offer_recipients;
create policy "admins manage offer recipients" on public.offer_recipients for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "staff read whatsapp messages" on public.whatsapp_messages;
create policy "staff read whatsapp messages" on public.whatsapp_messages for select
using (
  public.current_profile_role() = 'admin'
  or merchant_id = public.current_merchant_id()
  or exists (
    select 1
    from public.orders as order_row
    where order_row.id = whatsapp_messages.order_id
      and order_row.merchant_id = public.current_merchant_id()
  )
);

create or replace function public.create_offer_campaign(
  p_offer_id uuid,
  p_created_by uuid
)
returns table (
  campaign_id uuid,
  total_recipients integer,
  campaign_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_offer public.offers%rowtype;
  created_campaign public.offer_campaigns%rowtype;
  recipient_count integer;
begin
  select *
  into selected_offer
  from public.offers
  where id = p_offer_id
  for update;

  if selected_offer.id is null then
    raise exception 'Offer not found';
  end if;
  if selected_offer.status <> 'approved' then
    raise exception 'Only approved offers can be sent';
  end if;
  if selected_offer.expires_at <= now() then
    raise exception 'Expired offers cannot be sent';
  end if;

  select *
  into created_campaign
  from public.offer_campaigns
  where offer_id = p_offer_id;

  if created_campaign.id is null then
    insert into public.offer_campaigns (
      offer_id,
      merchant_id,
      status,
      created_by
    )
    values (
      selected_offer.id,
      selected_offer.merchant_id,
      'queued',
      p_created_by
    )
    returning * into created_campaign;

    insert into public.offer_recipients (
      campaign_id,
      offer_id,
      merchant_id,
      customer_id,
      recipient
    )
    select
      created_campaign.id,
      selected_offer.id,
      selected_offer.merchant_id,
      customer_row.id,
      customer_row.phone
    from public.customer_merchants as membership
    join public.customers as customer_row
      on customer_row.id = membership.customer_id
    where membership.merchant_id = selected_offer.merchant_id
      and customer_row.whatsapp_opt_in_at is not null
      and customer_row.phone ~ '^91[6-9][0-9]{9}$'
    on conflict (campaign_id, customer_id) do nothing;

    get diagnostics recipient_count = row_count;

    update public.offer_campaigns
    set
      total_recipients = recipient_count,
      queued_count = recipient_count,
      status = case when recipient_count = 0 then 'completed' else 'queued' end,
      completed_at = case when recipient_count = 0 then now() else null end,
      updated_at = now()
    where id = created_campaign.id
    returning * into created_campaign;

    update public.offers
    set broadcast_at = now(), updated_at = now()
    where id = selected_offer.id;
  end if;

  return query
  select
    created_campaign.id,
    created_campaign.total_recipients,
    created_campaign.status;
end;
$$;

revoke all on function public.create_offer_campaign(uuid, uuid) from public;
grant execute on function public.create_offer_campaign(uuid, uuid) to service_role;

create or replace function public.claim_offer_recipients(p_limit integer default 20)
returns table (
  recipient_id uuid,
  campaign_id uuid,
  offer_id uuid,
  merchant_id uuid,
  customer_id uuid,
  recipient text,
  attempts integer,
  customer_name text,
  merchant_name text,
  offer_title text,
  offer_description text,
  offer_expires_at timestamptz,
  image_path text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select recipient_row.id
    from public.offer_recipients as recipient_row
    join public.offer_campaigns as campaign_row
      on campaign_row.id = recipient_row.campaign_id
    where recipient_row.status in ('queued', 'failed')
      and recipient_row.attempts < 3
      and recipient_row.next_attempt_at <= now()
      and campaign_row.status in ('queued', 'processing')
    order by recipient_row.created_at
    for update of recipient_row skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  ),
  claimed as (
    update public.offer_recipients as recipient_row
    set
      status = 'processing',
      attempts = recipient_row.attempts + 1,
      error_code = null,
      error_message = null,
      updated_at = now()
    from picked
    where recipient_row.id = picked.id
    returning recipient_row.*
  ),
  campaigns_started as (
    update public.offer_campaigns as campaign_row
    set
      status = 'processing',
      started_at = coalesce(campaign_row.started_at, now()),
      updated_at = now()
    where campaign_row.id in (select distinct claimed.campaign_id from claimed)
    returning campaign_row.id
  )
  select
    claimed.id,
    claimed.campaign_id,
    claimed.offer_id,
    claimed.merchant_id,
    claimed.customer_id,
    claimed.recipient,
    claimed.attempts,
    customer_row.name,
    merchant_row.name,
    offer_row.title,
    offer_row.description,
    offer_row.expires_at,
    offer_row.image_path
  from claimed
  join campaigns_started
    on campaigns_started.id = claimed.campaign_id
  join public.offers as offer_row
    on offer_row.id = claimed.offer_id
  join public.merchants as merchant_row
    on merchant_row.id = claimed.merchant_id
  left join public.customers as customer_row
    on customer_row.id = claimed.customer_id;
end;
$$;

revoke all on function public.claim_offer_recipients(integer) from public;
grant execute on function public.claim_offer_recipients(integer) to service_role;

create or replace function public.refresh_offer_campaign(p_campaign_id uuid)
returns public.offer_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count integer;
  queued_total integer;
  processing_total integer;
  sent_total integer;
  delivered_total integer;
  read_total integer;
  failed_total integer;
  skipped_total integer;
  next_status text;
  refreshed_campaign public.offer_campaigns%rowtype;
begin
  select
    count(*)::integer,
    count(*) filter (where status = 'queued')::integer,
    count(*) filter (where status = 'processing')::integer,
    count(*) filter (where status = 'sent')::integer,
    count(*) filter (where status = 'delivered')::integer,
    count(*) filter (where status = 'read')::integer,
    count(*) filter (where status = 'failed')::integer,
    count(*) filter (where status = 'skipped')::integer
  into
    total_count,
    queued_total,
    processing_total,
    sent_total,
    delivered_total,
    read_total,
    failed_total,
    skipped_total
  from public.offer_recipients
  where campaign_id = p_campaign_id;

  if queued_total + processing_total > 0 then
    next_status := 'processing';
  elsif failed_total = total_count and total_count > 0 then
    next_status := 'failed';
  elsif failed_total > 0 or skipped_total > 0 then
    next_status := 'partial_failed';
  else
    next_status := 'completed';
  end if;

  update public.offer_campaigns
  set
    status = next_status,
    total_recipients = total_count,
    queued_count = queued_total,
    processing_count = processing_total,
    sent_count = sent_total,
    delivered_count = delivered_total,
    read_count = read_total,
    failed_count = failed_total,
    skipped_count = skipped_total,
    completed_at = case
      when next_status in ('completed', 'partial_failed', 'failed') then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where id = p_campaign_id
  returning * into refreshed_campaign;

  return refreshed_campaign;
end;
$$;

revoke all on function public.refresh_offer_campaign(uuid) from public;
grant execute on function public.refresh_offer_campaign(uuid) to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'offer-images',
  'offer-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;

-- After deployment, configure the queue worker in Supabase:
-- 1. Enable the pg_cron and pg_net extensions.
-- 2. Store the production URL and OFFER_QUEUE_SECRET in Vault.
-- 3. Schedule this request every minute:
--
-- select cron.schedule(
--   'affiliate-ae-offer-queue',
--   '* * * * *',
--   $$
--   select net.http_post(
--     url := (select decrypted_secret from vault.decrypted_secrets where name = 'offer_queue_url')
--       || '/api/internal/offers/process',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' ||
--         (select decrypted_secret from vault.decrypted_secrets where name = 'offer_queue_secret')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
