const assert=require('node:assert/strict'),fs=require('node:fs');
const {registerAdminAttendance}=require('../backend/admin-attendance.cjs');
const routes=[];let rpcCalls=0,rpcError=null,lastArgs;
const auth=()=>{},adminRole=()=>{};
registerAdminAttendance({get:(path,...handlers)=>routes.push({method:'GET',path,handlers}),post:(path,...handlers)=>routes.push({method:'POST',path,handlers})},{auth,adminRole,db:{async rpc(name,args){rpcCalls++;assert.equal(name,'admin_field_attendance_action');lastArgs=args;return {data:{id:'attendance'},error:rpcError}}},workDate:()=> '2026-10-26'});
const response=()=>({code:200,status(value){this.code=value;return this},json(value){this.body=value;return this}});
const manager='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222',attendance='33333333-3333-4333-8333-333333333333';
(async()=>{
 for(const route of routes){assert.equal(route.handlers[0],auth);assert.equal(route.handlers[1],adminRole);}
 const start=routes.find(r=>r.path.endsWith('force-start')).handlers.at(-1),end=routes.find(r=>r.path.endsWith('force-end')).handlers.at(-1);
 let res=response();await start({params:{id:manager},body:{reason:'bad'},auth:{profile:{id:admin}}},res);assert.equal(res.code,400);assert.equal(rpcCalls,0);
 res=response();await end({params:{id:manager},body:{reason:'GPS unavailable'},auth:{profile:{id:admin}}},res);assert.equal(res.code,400);assert.equal(rpcCalls,0);
 res=response();await start({params:{id:manager},body:{reason:'GPS unavailable',adminId:'spoof',managerId:'spoof',latitude:0,selfie:'fake'},auth:{profile:{id:admin}}},res);assert.equal(res.code,201);assert.deepEqual(lastArgs,{p_admin:admin,p_manager:manager,p_action:'start',p_reason:'GPS unavailable',p_attendance:null});
 res=response();await end({params:{id:manager},body:{reason:'Manager requested closure',attendanceId:attendance},auth:{profile:{id:admin}}},res);assert.equal(res.code,200);assert.equal(lastArgs.p_attendance,attendance);
 rpcError={code:'23505'};res=response();await start({params:{id:manager},body:{reason:'GPS unavailable'},auth:{profile:{id:admin}}},res);assert.equal(res.code,409);
 rpcError={code:'42501'};res=response();await start({params:{id:manager},body:{reason:'GPS unavailable'},auth:{profile:{id:admin}}},res);assert.equal(res.code,403);
 const sql=fs.readFileSync('supabase-field-attendance-admin.sql','utf8');assert.match(sql,/role='admin'/);assert.match(sql,/role='field_manager' for update/);assert.match(sql,/id=p_attendance and manager_id=p_manager for update/);assert.match(sql,/unique\(attendance_id,action\)/);assert.match(sql,/insert into public.field_attendance_admin_audit/);assert.match(sql,/from public,anon,authenticated/);assert.match(sql,/Asia\/Kolkata/);assert.ok(!/drop table|reward_points|update public\.field_attendance set started_at/i.test(sql));
 console.log('PASS: admin middleware on all routes, mandatory reason and exact end target, server-owned actor/manager, no forged GPS accepted, conflict/permission errors, SQL locks/atomic audit/IST/service-role-only grants');
})().catch(e=>{console.error(e);process.exitCode=1});
