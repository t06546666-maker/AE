const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const server=fs.readFileSync('server.js','utf8');
const start=server.indexOf("app.delete('/api/admin/field-managers/:id'");
const route=server.slice(start,server.indexOf("app.patch('/api/admin/field-updates",start));
let handler,called=0,args,error=null;const auth=()=>{},admin=()=>{};
vm.runInNewContext(route,{requireAuth:auth,requireRole:role=>{assert.equal(role,'admin');return admin},app:{delete(path,...handlers){assert.equal(handlers[0],auth);assert.equal(handlers[1],admin);handler=handlers.at(-1)}},supabaseAdmin:{async rpc(name,input){assert.equal(name,'admin_delete_field_manager');called++;args=input;return {error}}}});
const id='11111111-1111-4111-8111-111111111111',actor='22222222-2222-4222-8222-222222222222';
const res=()=>({statusCode:200,status(n){this.statusCode=n;return this},json(body){this.body=body;return this}});
const req=body=>({params:{id},body,auth:{profile:{id:actor}}});
(async()=>{
 let r=res();await handler(req({reason:'GPS issue'}),r);assert.equal(r.statusCode,400);assert.equal(called,0);
 r=res();await handler(req({confirmation:'DELETE',reason:'bad'}),r);assert.equal(r.statusCode,400);assert.equal(called,0);
 r=res();await handler(req({confirmation:'DELETE',reason:'Test account removal',adminId:'spoof'}),r);assert.equal(r.statusCode,200);assert.equal(args.p_admin,actor);assert.equal(args.p_manager,id);
 for(const [code,status] of [['23503',409],['P0002',404],['42501',403],['PGRST202',503]]){error={code};r=res();await handler(req({confirmation:'DELETE',reason:'Test account removal'}),r);assert.equal(r.statusCode,status);}
 const sql=fs.readFileSync('supabase-field-manager-delete.sql','utf8');assert.match(sql,/role='admin'/);assert.match(sql,/role='field_manager' for update/);assert.match(sql,/delete from auth.users where id=p_manager/);assert.match(sql,/insert into public.field_manager_deletion_audit/);assert.match(sql,/from public,anon,authenticated/);assert.ok(sql.indexOf('public.expense_claims where')<sql.indexOf('delete from public.field_attendance'));
 assert.ok(!/delete from (public\.)?(expense_claims|expense_receipts|expense_audit|merchants|customers|orders|point_redemptions)\b/i.test(sql));
 const ui=fs.readFileSync('src/components/AdminDeleteFieldManager.tsx','utf8');assert.match(ui,/retry:false/);assert.match(ui,/confirmation==='DELETE'/);assert.match(ui,/This cannot be undone/);
 console.log('PASS: admin-only delete, typed confirmation/reason, trusted actor/target, protected-record blocking, SQL scoped deletion and financial preservation; no real account deleted');
})().catch(e=>{console.error(e);process.exitCode=1});
