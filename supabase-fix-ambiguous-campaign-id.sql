-- Run once in Supabase SQL Editor to repair the ambiguous campaign_id error.
-- This replaces only the offer campaign function and preserves existing data.

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
  select offer_row.*
  into selected_offer
  from public.offers as offer_row
  where offer_row.id = p_offer_id
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

  select campaign_row.*
  into created_campaign
  from public.offer_campaigns as campaign_row
  where campaign_row.offer_id = p_offer_id;

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
    on conflict do nothing;

    get diagnostics recipient_count = row_count;

    update public.offer_campaigns as campaign_row
    set
      total_recipients = recipient_count,
      queued_count = recipient_count,
      status = case when recipient_count = 0 then 'completed' else 'queued' end,
      completed_at = case when recipient_count = 0 then now() else null end,
      updated_at = now()
    where campaign_row.id = created_campaign.id
    returning campaign_row.* into created_campaign;

    update public.offers as offer_row
    set broadcast_at = now(), updated_at = now()
    where offer_row.id = selected_offer.id;
  end if;

  return query
  select
    created_campaign.id,
    created_campaign.total_recipients,
    created_campaign.status;
end;
$$;

revoke all on function public.create_offer_campaign(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.create_offer_campaign(uuid, uuid)
to service_role;

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
    count(*) filter (where recipient_row.status = 'queued')::integer,
    count(*) filter (where recipient_row.status = 'processing')::integer,
    count(*) filter (where recipient_row.status = 'sent')::integer,
    count(*) filter (where recipient_row.status = 'delivered')::integer,
    count(*) filter (where recipient_row.status = 'read')::integer,
    count(*) filter (where recipient_row.status = 'failed')::integer,
    count(*) filter (where recipient_row.status = 'skipped')::integer
  into
    total_count,
    queued_total,
    processing_total,
    sent_total,
    delivered_total,
    read_total,
    failed_total,
    skipped_total
  from public.offer_recipients as recipient_row
  where recipient_row.campaign_id = p_campaign_id;

  if queued_total + processing_total > 0 then
    next_status := 'processing';
  elsif failed_total = total_count and total_count > 0 then
    next_status := 'failed';
  elsif failed_total > 0 or skipped_total > 0 then
    next_status := 'partial_failed';
  else
    next_status := 'completed';
  end if;

  update public.offer_campaigns as campaign_row
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
      when next_status in ('completed', 'partial_failed', 'failed')
        then coalesce(campaign_row.completed_at, now())
      else null
    end,
    updated_at = now()
  where campaign_row.id = p_campaign_id
  returning campaign_row.* into refreshed_campaign;

  return refreshed_campaign;
end;
$$;

revoke all on function public.refresh_offer_campaign(uuid)
from public, anon, authenticated;
grant execute on function public.refresh_offer_campaign(uuid)
to service_role;
