const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const server=fs.readFileSync('server.js','utf8');
const route=server.slice(server.indexOf("app.delete('/api/merchants/:id'"),server.indexOf('\nfunction customerOrderDto'));
let handler,calls=0,args,error=null;const auth=()=>{},admin=()=>{};
vm.runInNewContext(route,{app:{delete(path,...handlers){assert.equal(handlers[0],auth);assert.equal(handlers[1],admin);handler=handlers.at(-1)}},requireAuth:auth,requireRole:role=>{assert.equal(role,'admin');return admin},cleanText:value=>String(value||'').trim(),supabaseAdmin:{async rpc(name,input){assert.equal(name,'admin_delete_unused_merchant');calls++;args=input;return {error}}}});
const target='11111111-1111-4111-8111-111111111111';
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this},json(body){this.body=body;return this}});
const request=(body={confirmation:'DELETE'},id=target)=>({body,params:{id},auth:{profile:{id:'trusted-admin'}}});
(async()=>{
 let r=response();await handler(request({},target),r);assert.equal(r.statusCode,400);assert.equal(calls,0);
 r=response();await handler(request({confirmation:'DELETE'},'bad'),r);assert.equal(r.statusCode,400);assert.equal(calls,0);
 r=response();await handler(request({confirmation:'DELETE',p_admin:'spoof'}),r);assert.equal(r.statusCode,200);assert.equal(args.p_admin,'trusted-admin');assert.equal(args.p_merchant,target);assert.equal(r.body.deletedCustomers,0);
 for(const [code,status] of [['23503',409],['P0002',404],['42501',403],['PGRST202',503]]){error={code,message:'private database detail'};r=response();await handler(request(),r);assert.equal(r.statusCode,status);assert.ok(!r.body.error.includes('private'));}
 assert.doesNotMatch(route,/supabaseAdmin\.from\(|deleteUser/);
 const sql=fs.readFileSync('supabase-merchant-safe-delete.sql','utf8');
 assert.match(sql,/role='admin'/);assert.match(sql,/for update/);assert.match(sql,/pg_constraint/);assert.match(sql,/on delete set null/);assert.match(sql,/deleted_merchant_id=p_merchant/);assert.match(sql,/insert into public.merchant_deletion_audit/);assert.match(sql,/from public,anon,authenticated/);
 assert.ok(sql.indexOf('if linked then raise exception')<sql.indexOf('delete from auth.users'));
 assert.doesNotMatch(sql,/delete from (public\.)?(orders|customers|customer_orders|customer_merchants|field_manager_activity|expense_claims|payments)\b/i);
 assert.doesNotMatch(sql,/exception when/i,'Do not swallow SQL failures and commit partial deletion');
 const ui=fs.readFileSync('src/pages/Merchants.tsx','utf8');assert.match(ui,/retry: false/);assert.match(ui,/confirmation:'DELETE'/);assert.match(ui,/Field Manager activity are preserved/);
 console.log('PASS: admin-only confirmed RPC, trusted actor, safe conflict/setup errors, no sequential API deletes, SQL safeguards and preserved history. Mock/static checks; no live deletion performed.');
})().catch(e=>{console.error(e);process.exitCode=1});
