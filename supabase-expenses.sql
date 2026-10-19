-- Staff expenses v1. Review and apply before deploying portal routes.
begin;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','merchant','customer','field_manager','staff','account_head'));
alter table public.profiles drop constraint if exists merchant_role_assignment;
alter table public.profiles add constraint merchant_role_assignment check((role='merchant' and merchant_id is not null) or (role in ('admin','customer','field_manager','staff','account_head') and merchant_id is null));
create table if not exists public.expense_members (
 profile_id uuid primary key references public.profiles(id), department text not null check(department in ('Developer','Field Manager','HR','Marketing','Other')), active boolean not null default true
);
-- Existing field managers keep their credentials and receive their own membership.
insert into public.expense_members(profile_id,department) select id,'Field Manager' from public.profiles where role='field_manager' on conflict do nothing;
create table if not exists public.expense_claims (
 id uuid primary key, owner_id uuid not null references public.profiles(id), department text not null,
 category text not null check(category in ('Petrol/Fuel','Travel','IT Support','Marketing','Office Supplies','Other')),
 amount_paise bigint not null check(amount_paise between 1 and 100000000000), expense_date date not null,
 reason text not null check(length(btrim(reason)) between 1 and 2000), missing_receipt_reason text not null default '' check(length(missing_receipt_reason)<=2000),
 status text not null default 'draft' check(status in ('draft','submitted','corrections','approved','rejected','paid')),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 review_note text, reviewed_by uuid references public.profiles(id), payment_method text check(payment_method in ('Cash','UPI','Bank Transfer')),
 payment_date date, payment_reference text, payment_note text, paid_by uuid references public.profiles(id), paid_at timestamptz
);
create index if not exists expense_claims_owner on public.expense_claims(owner_id,created_at desc);
create index if not exists expense_claims_review on public.expense_claims(status,expense_date,department);
create table if not exists public.expense_receipts (
 id uuid primary key, claim_id uuid not null references public.expense_claims(id), path text not null unique,
 name text not null, mime text not null check(mime in ('image/jpeg','image/png','application/pdf')), created_at timestamptz not null default now()
);
create table if not exists public.expense_audit (
 id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.expense_claims(id), actor_id uuid not null references public.profiles(id),
 action text not null, snapshot jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.expense_requests (
 actor_id uuid not null references public.profiles(id), request_id uuid not null, signature jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(actor_id,request_id)
);
alter table public.expense_members enable row level security;
alter table public.expense_claims enable row level security;
alter table public.expense_receipts enable row level security;
alter table public.expense_audit enable row level security;
alter table public.expense_requests enable row level security;
-- All finance access goes through authenticated server routes; no client writes or reads.
revoke all on public.expense_members,public.expense_claims,public.expense_receipts,public.expense_audit,public.expense_requests from anon,authenticated;
grant all on public.expense_members,public.expense_claims,public.expense_receipts,public.expense_audit,public.expense_requests to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('expense-receipts','expense-receipts',false,5242880,array['image/jpeg','image/png','application/pdf'])
 on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
-- Restrict this bucket even if another existing permissive policy allows storage access.
drop policy if exists expense_receipts_server_only on storage.objects;
create policy expense_receipts_server_only on storage.objects as restrictive
 for all to anon,authenticated
 using (bucket_id <> 'expense-receipts') with check (bucket_id <> 'expense-receipts');

create or replace function public.expense_action(p_actor uuid,p_claim uuid,p_action text,p_payload jsonb,p_request uuid,p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.expense_claims%rowtype; member public.expense_members%rowtype; actor_role text; old public.expense_requests%rowtype;
 sig jsonb; answer jsonb; previous_status text; amount bigint; dt date;
begin
 if p_request is null or p_actor is null or p_claim is null then raise exception 'Missing request identity'; end if;
 sig:=jsonb_build_object('claim',p_claim,'action',p_action,'payload',p_payload,'version',p_version);
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_request::text,0));
 select * into old from public.expense_requests where actor_id=p_actor and request_id=p_request;
 if found then
  if old.signature<>sig then raise exception 'Request key already used for another action'; end if;
  return old.result||jsonb_build_object('replayed',true);
 end if;
 select role into actor_role from public.profiles where id=p_actor for share;
 select * into member from public.expense_members where profile_id=p_actor and active=true for share;
 if p_action='create' then
  if actor_role not in ('staff','field_manager') or member.profile_id is null then raise exception 'Employee access required'; end if;
  amount:=(p_payload->>'amount_paise')::bigint; dt:=(p_payload->>'expense_date')::date;
  if amount is null or dt is null or dt>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Invalid amount or expense date'; end if;
  insert into public.expense_claims(id,owner_id,department,category,amount_paise,expense_date,reason,missing_receipt_reason)
   values(p_claim,p_actor,member.department,p_payload->>'category',amount,dt,btrim(p_payload->>'reason'),coalesce(btrim(p_payload->>'missing_receipt_reason'),'')) returning * into c;
 else
  select * into c from public.expense_claims where id=p_claim for update;
  if not found then raise exception 'Claim not found'; end if;
  if p_version is null or c.version<>p_version then raise exception 'Claim changed. Refresh and retry.'; end if;
  previous_status:=c.status;
  if p_action in ('save','attach','submit') then
   if actor_role not in ('staff','field_manager') or member.profile_id is null or c.owner_id<>p_actor then raise exception 'Employee access required'; end if;
   if c.status not in ('draft','corrections') then raise exception 'Claim cannot be edited in this status'; end if;
   if p_action='save' then
    dt:=(p_payload->>'expense_date')::date; amount:=(p_payload->>'amount_paise')::bigint;
    if amount is null or dt is null or dt>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Invalid amount or expense date'; end if;
    update public.expense_claims set category=p_payload->>'category',amount_paise=amount,expense_date=dt,reason=btrim(p_payload->>'reason'),missing_receipt_reason=coalesce(btrim(p_payload->>'missing_receipt_reason'),'') where id=p_claim;
   elsif p_action='attach' then
    if (select count(*) from public.expense_receipts where claim_id=p_claim)>=5 then raise exception 'Maximum five receipts per claim'; end if;
    if p_payload->>'path' not like p_actor::text||'/'||p_claim::text||'/%' then raise exception 'Invalid receipt path'; end if;
    insert into public.expense_receipts(id,claim_id,path,name,mime) values((p_payload->>'id')::uuid,p_claim,p_payload->>'path',p_payload->>'name',p_payload->>'mime');
   else
    -- Receipts and supplementary notes are optional; all other submission checks remain.
    update public.expense_claims set status='submitted' where id=p_claim;
   end if;
  elsif p_action in ('approve','reject','corrections','pay') then
   if actor_role is distinct from 'account_head' or member.profile_id is null or c.owner_id=p_actor then raise exception 'Account Head access required; self-review is not allowed'; end if;
   if p_action='pay' then
    if c.status<>'approved' then raise exception 'Only approved claims can be marked paid'; end if;
    dt:=(p_payload->>'payment_date')::date;
    if dt is null or dt>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Invalid payment date'; end if;
    if p_payload->>'payment_method' is null or p_payload->>'payment_method' not in ('Cash','UPI','Bank Transfer') then raise exception 'Choose a payment method'; end if;
    if length(btrim(coalesce(p_payload->>case when p_payload->>'payment_method'='Cash' then 'payment_note' else 'payment_reference' end,'')))=0 then raise exception 'Payment reference or cash note required'; end if;
    update public.expense_claims set status='paid',payment_method=p_payload->>'payment_method',payment_date=dt,payment_reference=p_payload->>'payment_reference',payment_note=p_payload->>'payment_note',paid_by=p_actor,paid_at=now() where id=p_claim;
   else
    if c.status<>'submitted' then raise exception 'Only submitted claims can be reviewed'; end if;
    if p_action in ('reject','corrections') and length(btrim(coalesce(p_payload->>'note','')))=0 then raise exception 'Explain the review decision'; end if;
    update public.expense_claims set status=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'corrections' end,review_note=p_payload->>'note',reviewed_by=p_actor where id=p_claim;
   end if;
  else raise exception 'Invalid action'; end if;
  update public.expense_claims set version=version+1,updated_at=now() where id=p_claim returning * into c;
 end if;
 insert into public.expense_audit(claim_id,actor_id,action,snapshot) values(p_claim,p_actor,p_action,jsonb_build_object('claim',to_jsonb(c),'receipts',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.expense_receipts r where r.claim_id=p_claim)));
 answer:=jsonb_build_object('claim',to_jsonb(c),'replayed',false);
 insert into public.expense_requests(actor_id,request_id,signature,result) values(p_actor,p_request,sig,answer);
 return answer;
end $$;
revoke all on function public.expense_action(uuid,uuid,text,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.expense_action(uuid,uuid,text,jsonb,uuid,integer) to service_role;
commit;
