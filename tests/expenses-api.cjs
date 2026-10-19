const assert=require('node:assert/strict'),express=require('express'),crypto=require('node:crypto');
const {registerExpenses,money,claimInput,receiptType}=require('../backend/expenses.cjs');
assert.equal(money('123.45'),12345);assert.equal(money('0.01'),1);
for(const invalid of ['1.001','-1','1e3','0','Infinity',1])assert.throws(()=>money(invalid));
assert.throws(()=>claimInput({category:'Salary',amount:'1.00',expense_date:'2026-01-01',reason:'x'}));
assert.equal(receiptType(Buffer.from('%PDF-1.7\n')),'application/pdf');assert.equal(receiptType(Buffer.from('<html>')) ,null);
async function main(){
 const ids=Object.fromEntries(['employee','other','head','admin','merchant','field'].map(key=>[key,crypto.randomUUID()]));
 const tables={profiles:Object.entries(ids).map(([key,id])=>({id,role:{employee:'staff',other:'staff',head:'account_head',admin:'admin',merchant:'merchant',field:'field_manager'}[key],full_name:key,must_change_password:false})),expense_members:[],expense_claims:[],expense_receipts:[],expense_audit:[]};
 for(const key of ['employee','other','head'])tables.expense_members.push({profile_id:ids[key],department:'Developer',active:true});
 const claim={id:crypto.randomUUID(),owner_id:ids.employee,department:'Developer',category:'Petrol/Fuel',amount_paise:12345,expense_date:'2026-01-01',reason:'Fuel',status:'draft',version:1};tables.expense_claims.push(claim);
 const receipt={id:crypto.randomUUID(),claim_id:claim.id,path:'private/path',name:'fuel.pdf'};tables.expense_receipts.push(receipt);
 let rpcArgs,signed=0,notifications=[];
 const db={from(table){let filters=[],values,operation='select',single=false,lo=0,hi=999,selection='';
  const q={select(value){selection=value;return q},eq(key,value){filters.push(row=>row[key]===value);return q},in(key,values){filters.push(row=>values.includes(row[key]));return q},gte(key,value){filters.push(row=>row[key]>=value);return q},lte(key,value){filters.push(row=>row[key]<=value);return q},order(){return q},range(a,b){lo=a;hi=b;return q},maybeSingle(){single=true;return q},single(){single=true;return q},upsert(value){operation='upsert';values=value;return q},insert(value){operation='insert';values=value;return q},update(value){operation='update';values=value;return q},delete(){operation='delete';return q},then(resolve,reject){try{
   if(operation==='insert')tables[table].push(values);
   if(operation==='upsert'&&!tables[table].some(r=>r.profile_id===values.profile_id))tables[table].push({...values,active:true});
   let rows=tables[table].filter(row=>filters.every(filter=>filter(row)));
   if(operation==='update')rows.forEach(row=>Object.assign(row,values));
   rows=rows.map(row=>({...row,...(selection.includes('profiles!')?{profiles:tables.profiles.find(p=>p.id===(row.profile_id||row.owner_id))}: {})}));
   return Promise.resolve({data:single?rows[0]||null:rows.slice(lo,hi+1),count:rows.length,error:null}).then(resolve,reject);
  }catch(error){return Promise.reject(error).then(resolve,reject)}}};return q},
  rpc(_name,args){rpcArgs=args;return Promise.resolve({data:{claim:{...claim,status:args.p_action==='submit'?'submitted':'approved'},replayed:args.p_request===ids.other},error:null})},
  storage:{from(){return {createSignedUrl(){signed++;return Promise.resolve({data:{signedUrl:'https://example.test/private-receipt?expires=60'},error:null})},upload(){return Promise.resolve({error:null})},remove(){return Promise.resolve({error:null})}}}},
 };
 const auth={auth:{signInWithPassword({email,password}){const key=email.split('@')[0];const profile=tables.profiles.find(p=>p.id===ids[key]);return Promise.resolve(password==='valid'&&profile?{data:{user:{id:profile.id,email},session:{access_token:'test-access',refresh_token:'test-refresh'}}}:{error:{message:'invalid'}})}}};
 const app=express();app.use(express.json());
 const requireAuth=(req,res,next)=>{const profile=tables.profiles.find(p=>p.id===ids[req.get('x-user')]);if(!profile)return res.status(401).json({error:'Authentication required'});req.auth={profile,user:{id:profile.id}};next()};
 registerExpenses(app,{db,auth,requireAuth,requireRole:role=>(req,res,next)=>req.auth.profile.role===role?next():res.status(403).json({error:'Forbidden'}),notifyProfile:async(...args)=>notifications.push(args),notifyRole:async()=>{}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 async function call(path,user,body,method=body?'POST':'GET'){const response=await fetch(base+path,{method,headers:{...(user?{'x-user':user}:{}),...(!(body instanceof FormData)?{'content-type':'application/json'}:{})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});return {status:response.status,body:await response.json()}}
 try{
  for(const path of ['/api/accounts/summary?month=2026-01','/api/accounts/report'])assert.equal((await call(path,'admin')).status,403);
  assert.equal((await call('/api/accounts/summary?month=bad','head')).status,400);
  assert.equal((await call('/api/accounts/report?from=2026-02-01&to=2026-01-01','head')).status,400);
  assert.equal((await call('/api/accounts/report?bucket=pending','head')).body.total,0);
  tables.expense_claims.push({...claim,id:crypto.randomUUID(),status:'approved',amount_paise:50000},{...claim,id:crypto.randomUUID(),status:'paid',amount_paise:20000,payment_date:'2026-02-01',payment_method:'Cash',payment_note:'Received'});
  assert.equal((await call('/api/accounts/report?bucket=pending','head')).body.total,1);
  assert.equal((await call('/api/accounts/report?bucket=history&from=2026-02-01&to=2026-02-01','head')).body.total,1);
  assert.equal((await call('/api/accounts/report?bucket=history&to=2026-01-31','head')).body.total,0);
  assert.deepEqual((await call('/api/accounts/summary?month=2026-01','head')).body.totals,{requested:'70000',approved:'70000',paid:'20000',outstanding:'50000'});
  const excel=await fetch(base+'/api/accounts/report?bucket=history&format=xlsx',{headers:{'x-user':'head'}});assert.equal(excel.status,200);assert.equal(Buffer.from(await excel.arrayBuffer()).subarray(0,2).toString(),'PK');
  tables.expense_claims.splice(1);
  assert.equal((await call('/api/expenses/claims')).status,401);
  for(const user of ['employee','admin','merchant','field'])assert.equal((await call('/api/accounts/claims',user)).status,403);
  assert.equal((await call('/api/expenses/claims','admin')).status,403);
  assert.equal((await call('/api/admin/expense-staff','head')).status,403);
  assert.equal((await call('/api/admin/expense-staff','admin')).status,200);
  assert.equal((await call('/api/expenses/claims/'+claim.id,'other')).status,404);
  assert.equal((await call('/api/expenses/claims/'+claim.id+'/receipts/'+receipt.id,'other')).status,404);assert.equal(signed,0);
  assert.equal((await call('/api/accounts/claims/'+claim.id+'/receipts/'+receipt.id,'admin')).status,403);assert.equal(signed,0);
  assert.equal((await call('/api/expenses/claims/'+claim.id+'/receipts/'+receipt.id,'employee')).status,200);assert.equal(signed,1);
  assert.equal((await call('/api/accounts/claims/'+claim.id+'/receipts/'+receipt.id,'head')).status,200);
  assert.equal((await call('/api/expenses/login',null,{email:'employee@test.local',password:'valid',department:'HR'})).status,403);
  assert.equal((await call('/api/expenses/login',null,{email:'head@test.local',password:'valid',department:'Developer'})).status,403);
  assert.equal((await call('/api/expenses/login',null,{email:'head@test.local',password:'valid',portal:'accounts'})).status,200);
  assert.equal((await call('/api/expenses/login',null,{email:'employee@test.local',password:'valid',department:'Developer'})).status,200);
  assert.equal((await call('/api/expenses/claims','employee')).body.summary.draft.amount_paise,'12345');
  const body={id:crypto.randomUUID(),request_id:crypto.randomUUID(),category:'IT Support',amount:'10.01',expense_date:'2026-01-01',reason:'Company tools',owner_id:ids.other};assert.equal((await call('/api/expenses/claims','employee',body)).status,200);assert.equal(rpcArgs.p_actor,ids.employee);assert.equal(rpcArgs.p_payload.amount_paise,1001);assert.ok(!('owner_id'in rpcArgs.p_payload));
  assert.equal((await call('/api/expenses/claims/'+claim.id+'/submit','employee',{request_id:crypto.randomUUID(),version:1})).status,200);assert.equal(notifications[0][0],ids.head);assert.ok(notifications[0][3].url.startsWith('/accounts?claim='));
  const before=notifications.length;await call('/api/expenses/claims/'+claim.id+'/submit','employee',{request_id:ids.other,version:1});assert.equal(notifications.length,before);
  await call('/api/accounts/claims/'+claim.id+'/review','head',{request_id:crypto.randomUUID(),version:1,action:'approve'});assert.equal(notifications.at(-1)[0],ids.employee);
  const bad=new FormData();bad.set('receipt',new Blob(['<html>'],{type:'application/pdf'}),'bad.pdf');bad.set('request_id',crypto.randomUUID());bad.set('version','1');assert.equal((await call('/api/expenses/claims/'+claim.id+'/receipts','employee',bad)).status,400);
  const large=new FormData();large.set('receipt',new Blob([new Uint8Array(5*1024*1024+1)],{type:'application/pdf'}),'large.pdf');assert.equal((await call('/api/expenses/claims/'+claim.id+'/receipts','employee',large)).status,400);
  tables.expense_members.find(m=>m.profile_id===ids.employee).active=false;assert.equal((await call('/api/expenses/claims','employee')).status,403);
  console.log('PASS: HTTP authentication, department login, employee isolation, admin finance denial, receipt access/magic/size, exact totals, trusted actor IDs, notification links and replay suppression.');
 }finally{await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1});
