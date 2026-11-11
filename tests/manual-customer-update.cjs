const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {registerManualCustomerUpdate,normalizeMessage,templateValid,BODY}=require('../backend/manual-customer-update.cjs');
const id='11111111-1111-4111-8111-111111111111';
function fixture(status='APPROVED'){
 const routes=new Map(),customer={id,name:'Demo Customer',phone:'919999999999',reward_points:123.45,whatsapp_enabled:true},logs=new Map(),audit=new Map(),sent=[];
 const db={from(table){let op='select',value;const q={select(){return q},eq(){if(op==='update')return Promise.resolve({});return q},async maybeSingle(){return{data:customer}},async in(){return{data:[customer]}},async insert(row){logs.set(row.id,row);return{}},update(row){op='update';value=row;return q}};return q;}};
 let tail=Promise.resolve();const store={collection(){return{doc(key){return{key,update:async row=>audit.set(key,{...audit.get(key),...row})}}}},runTransaction(fn){const task=tail.then(async()=>{const tx={get:async ref=>({exists:audit.has(ref.key),data:()=>audit.get(ref.key)}),set:(ref,row)=>audit.set(ref.key,row)};return fn(tx);});tail=task.catch(()=>{});return task;}};
 const auth=()=>{},adminRole=()=>{};
 registerManualCustomerUpdate({get(path,a,b,h){assert.equal(a,auth);assert.equal(b,adminRole);routes.set('GET '+path,h)},post(path,a,b,h){assert.equal(a,auth);assert.equal(b,adminRole);routes.set('POST '+path,h)}},{auth,adminRole,db,database:async()=>store,normalizePhone:p=>p,templateName:'ae_customer_update',inspectTemplate:async()=>({name:'ae_customer_update',status,language:'ml',category:'UTILITY',components:[{type:'BODY',text:BODY}]}),sendTemplate:async args=>{sent.push(args);return{sent:true}}});
 async function call(path,body={},params={id}){let code=200,payload;await routes.get(path)({body,params,auth:{profile:{id:'admin'}}},{set(){},status(n){code=n;return this},json(p){payload=p;return this}});return{code,payload};}
 return{call,customer,sent,logs,audit};
}
async function run(){
 assert.equal(normalizeMessage('  hello\n world  '),'hello world');
 assert(templateValid({name:'ae_customer_update',language:'ml',components:[{type:'BODY',text:BODY}]},'ae_customer_update'));
 assert(!templateValid({name:'ae_customer_update',language:'en',components:[{type:'BODY',text:BODY}]},'ae_customer_update'));
 const pending=fixture('PENDING');assert.equal((await pending.call('POST /api/admin/customers/:id/account-update',{requestId:crypto.randomUUID(),message:'Account update'})).code,409);assert.equal(pending.sent.length,0);
 const f=fixture();const preview=await f.call('POST /api/admin/customer-update/preview',{customerIds:[id]});assert.equal(preview.payload.recipients[0].points,123.45);assert(!('phone' in preview.payload.recipients[0]));
 const requestId=crypto.randomUUID(),body={requestId,message:'Your account update',points:9999,name:'Spoofed'};
 const results=await Promise.all([f.call('POST /api/admin/customers/:id/account-update',body),f.call('POST /api/admin/customers/:id/account-update',body)]);assert(results.some(r=>r.code===200));assert.equal(f.sent.length,1);assert.deepEqual(f.sent[0].components[0].parameters.map(p=>p.text),['Demo Customer','123.45','Your account update']);assert.equal(f.sent[0].languageCode,'ml');assert.equal(f.sent[0].templateName,'ae_customer_update');assert.equal(f.customer.reward_points,123.45);assert.equal(f.logs.size,1);
 assert.equal((await f.call('POST /api/admin/customers/:id/account-update',body)).payload.duplicate,true);assert.equal(f.sent.length,1);
 assert.equal((await f.call('POST /api/admin/customers/:id/account-update',{...body,message:'Different message'})).code,409);
 f.customer.whatsapp_enabled=false;assert.equal((await f.call('POST /api/admin/customers/:id/account-update',{...body,requestId:crypto.randomUUID()})).code,409);assert.equal(f.sent.length,1);
 assert.equal((await f.call('POST /api/admin/customer-update/preview',{customerIds:['bad']})).code,400);
 assert.equal((await f.call('POST /api/admin/customers/:id/account-update',{message:'x'.repeat(701),requestId:crypto.randomUUID()})).code,400);
 console.log('PASS: approval gate, Malayalam schema, live balance/name, opt-out, private preview, idempotent/concurrent send, tamper and input checks; no real messages sent');
}
run().catch(e=>{console.error(e);process.exitCode=1});
