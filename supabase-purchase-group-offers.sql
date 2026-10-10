-- Enables restricted purchase-group offers. Run in Supabase SQL Editor.
-- Existing all-customer and loyal-customer offers keep their audiences.
begin;
alter table public.offers add column if not exists purchase_segment jsonb;
alter table public.offers drop constraint if exists offers_audience_check;
alter table public.offers add constraint offers_audience_check check (audience in ('all','loyal','purchase_range'));
do $$
declare fn regprocedure; definition text; old_rule text; new_rule text;
begin
 fn:=to_regprocedure('public.create_offer_campaign(uuid,uuid)');
 if fn is null then raise exception 'Apply supabase-loyalty.sql first. No changes applied.';end if;
 definition:=pg_get_functiondef(fn);
 if position('AE_PURCHASE_GROUP_AUDIENCE' in definition)>0 then return;end if;
 old_rule:='(selected_offer.audience = ''all'' or (select count(*) from public.orders o where o.merchant_id=selected_offer.merchant_id and o.customer_id=customer_row.id)>=5)';
 new_rule:='(/* AE_PURCHASE_GROUP_AUDIENCE */ selected_offer.audience = ''all'' or (selected_offer.audience = ''loyal'' and (select count(*) from public.orders o where o.merchant_id=selected_offer.merchant_id and o.customer_id=customer_row.id)>=5) or (selected_offer.audience = ''purchase_range'' and exists (select 1 from public.orders o where o.merchant_id=selected_offer.merchant_id and o.customer_id=customer_row.id and o.created_at >= (selected_offer.purchase_segment->>''from'')::timestamptz and o.created_at < (selected_offer.purchase_segment->>''to'')::timestamptz and o.amount >= (selected_offer.purchase_segment->>''min'')::numeric and (selected_offer.purchase_segment->>''max'' is null or o.amount < (selected_offer.purchase_segment->>''max'')::numeric))))';
 if position(old_rule in definition)=0 then raise exception 'Campaign audience logic differs. No changes applied; review installed function.';end if;
 execute replace(definition,old_rule,new_rule);
end $$;
notify pgrst,'reload schema';
commit;
