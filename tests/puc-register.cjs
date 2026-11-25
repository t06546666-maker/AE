const assert=require('node:assert/strict');
const {registerPuc,eligibleCategory,registration}=require('../backend/puc-register.cjs');
assert.equal(eligibleCategory('Vehicle Pollution Testing Centre'),true);assert.equal(eligibleCategory('PUC'),true);for(const name of ['Supermarket','Used cars','Vehicle showroom','Bakery'])assert.equal(eligibleCategory(name),false);
const value={name:'Test Customer',phone:'9800000000',plate:'KL09AB1234',model:'Test car',amount:400,rate:10,testDate:'2026-11-25',expiryDate:'2027-05-25',consent:true};
assert.equal(registration(value).amount,400);assert.throws(()=>registration({...value,consent:false}));assert.throws(()=>registration({...value,expiryDate:'2026-02-30'}));
let category='PUC',awards=0;const docs=new Map(),handlers={},auth=()=>{},role=()=>{};
const reference=id=>({id,async get(){return {exists:docs.has(id),data:()=>docs.get(id)}},async update(data){docs.set(id,{...docs.get(id),...data})}});
const store={collection(){return {doc(){return {collection(){return {doc:reference}}}}}},async runTransaction(fn){return fn({get:ref=>ref.get(),set(ref,data){docs.set(ref.id,data)}})}};
const db={from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:{id:'shop',name:'PUC Shop',merchant_categories:{name:category}},error:null}}}}};
registerPuc({get(path,...h){assert.equal(h[0],auth);assert.equal(h[1],role);handlers[path]=h.at(-1)},post(path,...h){assert.equal(h[0],auth);assert.equal(h[1],role);handlers[path]=h.at(-1)}},{db,database:async()=>store,auth,merchantRole:role,rewards:async()=>({earnOptions:[5,10]}),onboard:async()=>{awards++;return {status:201,body:{success:true,customer:{id:'C1'},order:{order_id:'order',order_no:'O1',points_earned:40}}}}});
const reply=()=>({code:200,status(code){this.code=code;return this},json(body){this.body=body;return this}}),request=(key='11111111-1111-4111-8111-111111111111',body=value)=>({body,auth:{profile:{merchant_id:'shop'}},get:()=>key});
(async()=>{
 const save=handlers['/api/merchant/puc/records'];let res=reply();category='Grocery';await save(request(),res);assert.equal(res.code,403);assert.equal(awards,0);
 category='PUC';res=reply();await save(request(undefined,{...value,rate:50}),res);assert.equal(res.code,400);assert.equal(awards,0);
 res=reply();await save(request(),res);assert.equal(res.code,201);assert.equal(res.body.record.points,40);assert.equal(awards,1);
 res=reply();await save(request(),res);assert.equal(res.body.success,true);assert.equal(awards,1);
 res=reply();await save(request(undefined,{...value,amount:500}),res);assert.equal(res.code,409);assert.equal(awards,1);
 console.log('PASS: PUC-only authorization, official rates, confirmation, persisted records and duplicate purchase protection');
})().catch(e=>{console.error(e);process.exitCode=1});
