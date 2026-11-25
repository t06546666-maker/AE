const assert=require('node:assert/strict');
const express=require('express');
const jwt=require('jsonwebtoken');
const {privatePucTest,pointsFor}=require('../backend/private-puc-test.cjs');
const map=new Map();
function collection(path){return {doc(id){const key=path+'/'+id;return {key,get:async()=>({exists:map.has(key),data:()=>map.get(key)}),collection:name=>collection(key+'/'+name)};},where(field,op,value){return {limit(){return {get:async()=>({docs:[...map].filter(([k,v])=>k.startsWith(path+'/')&&k.split('/').length===2&&v[field]===value).map(([k,v])=>({data:()=>v}))})};}};},orderBy(){return {limit(n){return {get:async()=>({docs:[...map].filter(([k])=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1).map(([k,v])=>({id:k.split('/').at(-1),data:()=>v})).sort((a,b)=>b.data().createdAt-a.data().createdAt).slice(0,n)})};}};}};}
const db={collection,runTransaction:async fn=>fn({get:ref=>ref.get(),set:(ref,value)=>map.set(ref.key,value)})};
const app=express();app.use(express.json());let fallthrough=0;
const test=privatePucTest({database:async()=>db,signingKey:'unit-test-only-key',rewards:async()=>({earnOptions:[10,20]}),adminAuth:(req,res,next)=>{if(req.get('Authorization')!=='Bearer admin-test')return res.sendStatus(401);req.auth={profile:{id:'admin1',role:'admin'}};next();},adminRole:(req,res,next)=>next()});app.use(test.middleware);test.register(app);app.use((req,res)=>{fallthrough++;res.json({live:true});});
(async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,method='GET',body,token,key)=>{const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json().catch(()=>null)};};
 try{
  assert.equal((await call('/api/customer/merchants')).body.live,true);
  assert.equal((await call('/api/admin/private-puc-test','POST',{requestId:crypto.randomUUID()})).status,401);
  const requestId=crypto.randomUUID(),created=await call('/api/admin/private-puc-test','POST',{requestId},'admin-test');assert.equal(created.status,201);
  assert.deepEqual((await call('/api/admin/private-puc-test','POST',{requestId},'admin-test')).body,created.body);
  assert.equal(map.size,1);assert.equal(created.body.whatsapp.sent,false);
  assert.equal((await call('/api/auth/login','POST',{email:created.body.loginEmail,password:'wrong'})).status,401);
  const login=await call('/api/auth/login','POST',{email:created.body.merchantCode,password:created.body.temporaryPassword});assert.equal(login.status,200);const token=login.body.accessToken;
  assert.equal((await call('/api/auth/me','GET',null,token)).body.user.testAccount,true);
  assert.equal((await call('/api/profile/legal','GET',null,token)).body.enabled,false);
  assert.equal((await call('/api/merchant/puc/config','GET',null,token)).body.eligible,true);
  const value={name:'Test User',phone:'9000000000',plate:'KL01TEST',model:'Test vehicle',amount:200,rate:20,testDate:'2026-11-25',expiryDate:'2027-05-25',consent:true},key=crypto.randomUUID();
  assert.equal((await call('/api/merchant/puc/records','POST',{...value,rate:99},token,key)).status,400);
  const record=await call('/api/merchant/puc/records','POST',value,token,key);assert.equal(record.status,201);assert.equal(record.body.record.points,40);
  assert.equal((await call('/api/merchant/puc/records','POST',value,token,key)).status,200);
  assert.equal((await call('/api/merchant/puc/records','POST',{...value,amount:300},token,key)).status,409);
  assert.equal((await call('/api/merchant/puc/records','GET',null,token)).body.records.length,1);
  assert.equal((await call('/api/customers','GET',null,token)).body.customers.length,1);
  assert.equal((await call('/api/orders','GET',null,token)).body.orders[0].amount,200);
  assert.equal((await call('/api/dashboard','GET',null,token)).body.summary.totalOrders,1);
  const before=fallthrough;
  for(const path of ['/api/customers','/api/merchants','/api/admin/private-puc-test','/api/shop-checkout','/api/merchant/rewards'])assert.equal((await call(path,'POST',{},token)).status,403);
  assert.equal(fallthrough,before,'Sandbox must never reach live handlers');
  assert.equal((await call('/api/auth/me','GET',null,login.body.refreshToken)).status,401);
  assert.equal((await call('/api/auth/refresh','POST',{refreshToken:login.body.refreshToken})).status,200);
  const fake=jwt.sign({iss:'ae-private-puc-test',kind:'access'},'wrong-key');assert.equal((await call('/api/orders','GET',null,fake)).status,401);
  const second=await call('/api/admin/private-puc-test','POST',{requestId:crypto.randomUUID()},'admin-test');
  const other=await call('/api/auth/login','POST',{email:second.body.loginEmail,password:second.body.temporaryPassword});assert.equal((await call('/api/merchant/puc/records','GET',null,other.body.accessToken)).body.records.length,0);
  assert.equal((await call('/api/merchants/'+login.body.user.id,'GET',null,other.body.accessToken)).status,403);
  map.get('ae_private_puc_tests/'+login.body.user.id).disabled=true;assert.equal((await call('/api/auth/me','GET',null,token)).status,401);
  assert.equal(pointsFor(1,20),1);assert.equal(pointsFor(10,20),2);assert.equal(pointsFor(50,20),5);assert.equal(pointsFor(1000,20),100);
  console.log('Private PUC account authentication, isolation, persistence, duplicate protection, points and blocked live writes: PASS');
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
