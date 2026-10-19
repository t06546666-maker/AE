const {PGlite}=require('@electric-sql/pglite');
const assert=require('node:assert/strict');const fs=require('node:fs');const crypto=require('node:crypto');
async function main(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid,bucket_id text);
 alter table storage.objects enable row level security;
 create table public.profiles(id uuid primary key,role text not null,merchant_id uuid,full_name text);
 `);
 const employee=crypto.randomUUID(),other=crypto.randomUUID(),head=crypto.randomUUID(),admin=crypto.randomUUID(),field=crypto.randomUUID();
 for(const [id,role]of [[employee,'staff'],[other,'staff'],[head,'account_head'],[admin,'admin'],[field,'field_manager']])await db.query('insert into profiles(id,role) values($1,$2)',[id,role]);
 const migration=fs.readFileSync('supabase-expenses.sql','utf8');await db.exec(migration);await db.exec(migration);
 for(const id of [employee,other,head])await db.query('insert into expense_members(profile_id,department) values($1,$2)',[id,'Developer']);
 const input={category:'Petrol/Fuel',amount_paise:12345,expense_date:'2026-01-01',reason:'Fuel for field visit',missing_receipt_reason:'No paper receipt issued'};
 async function action(actor,id,kind,payload,version,request=crypto.randomUUID()) {const r=await db.query('select expense_action($1,$2,$3,$4::jsonb,$5,$6) as result',[actor,id,kind,JSON.stringify(payload),request,version]);return r.rows[0].result;}
 const id=crypto.randomUUID(),key=crypto.randomUUID();let r=await action(employee,id,'create',input,null,key);assert.equal(r.claim.amount_paise,12345);
 assert.equal((await action(employee,id,'create',input,null,key)).replayed,true);
 await assert.rejects(action(employee,id,'create',{...input,reason:'Different'},null,key),/Request key/);
 await assert.rejects(action(other,id,'save',input,1),/Employee access/);
 await assert.rejects(action(admin,id,'approve',{},1),/Account Head/);
 await assert.rejects(action(head,id,'pay',{payment_date:'2026-01-01',payment_method:'Cash',payment_note:'Paid cash'},1),/Only approved/);
 r=await action(employee,id,'submit',{},1);assert.equal(r.claim.status,'submitted');
 await assert.rejects(action(employee,id,'save',input,2),/cannot be edited/);
 await assert.rejects(action(head,id,'corrections',{note:''},2),/Explain/);
 r=await action(head,id,'corrections',{note:'Explain the route'},2);assert.equal(r.claim.status,'corrections');
 r=await action(employee,id,'save',{...input,reason:'Route A petrol'},3);
 r=await action(employee,id,'submit',{},4);
 const decisions=await Promise.allSettled([action(head,id,'approve',{},5),action(head,id,'reject',{note:'Duplicate'},5)]);
 assert.equal(decisions.filter(d=>d.status==='fulfilled').length,1);assert.equal(decisions.filter(d=>d.status==='rejected').length,1);
 assert.equal((await db.query('select status from expense_claims where id=$1',[id])).rows[0].status,'approved');
 const payKey=crypto.randomUUID();r=await action(head,id,'pay',{payment_method:'Cash',payment_date:'2026-01-01',payment_note:'Cash handed over'},6,payKey);assert.equal(r.claim.status,'paid');
 assert.equal((await action(head,id,'pay',{payment_method:'Cash',payment_date:'2026-01-01',payment_note:'Cash handed over'},6,payKey)).replayed,true);
 await assert.rejects(action(head,id,'pay',{payment_method:'Cash',payment_date:'2026-01-01',payment_note:'Again'},7),/Only approved/);
 for(const method of ['UPI','Bank Transfer']){const claim=crypto.randomUUID();await action(employee,claim,'create',input,null);await action(employee,claim,'submit',{},1);await action(head,claim,'approve',{},2);await assert.rejects(action(head,claim,'pay',{payment_method:method,payment_date:'2026-01-01'},3),/reference/);await action(head,claim,'pay',{payment_method:method,payment_date:'2026-01-01',payment_reference:'UTR-123'},3);}
 const noReceipt=crypto.randomUUID();await action(employee,noReceipt,'create',{...input,missing_receipt_reason:''},null);await action(employee,noReceipt,'submit',{},1);
 await assert.rejects(action(employee,noReceipt,'attach',{id:crypto.randomUUID(),path:employee+'/'+noReceipt+'/other',name:'other.pdf',mime:'application/pdf'},2),/cannot be edited/);
 await db.query('update expense_claims set owner_id=$1 where id=$2',[head,noReceipt]);await assert.rejects(action(head,noReceipt,'approve',{},2),/self-review/);
 await db.query('update expense_members set active=false where profile_id=$1',[head]);await assert.rejects(action(head,noReceipt,'reject',{note:'No'},2),/Account Head/);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from expense_claims'),/permission denied/);await assert.rejects(action(employee,id,'submit',{},7),/permission denied/);await db.exec('reset role');
 assert.equal((await db.query("select public from storage.buckets where id='expense-receipts'")).rows[0].public,false);
 assert.ok((await db.query('select count(*)::int as n from expense_audit where claim_id=$1',[id])).rows[0].n>=7);
 await db.close();console.log('PASS: real embedded PostgreSQL migration/rerun, roles, ownership, exact paise, receipt requirement, corrections, stale concurrent decisions, idempotency, three payment methods, immutable paid claims, private bucket and client-denied access.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
