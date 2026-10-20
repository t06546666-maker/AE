const assert=require('node:assert/strict');
const {registerShopRequests,shopQrPayload}=require('../backend/shop-checkout-requests.cjs');
const id='11111111-1111-4111-8111-111111111111';
const docs=new Map();let writes=0,reads=0;
const db={collection(name){assert.equal(name,'ae_shop_qr');return {doc(key){return {key}}}},async runTransaction(fn){return fn({get:async ref=>({exists:docs.has(ref.key),data:()=>docs.get(ref.key)}),set(ref,data){writes++;docs.set(ref.key,data)}})}};
const database=async()=>db;
const routes=new Map();
const auth=(req,res,next)=>req.role?next():res.status(401).json({error:'Sign in'});
const role=expected=>(req,res,next)=>req.role===expected?next():res.status(403).json({error:'Forbidden'});
const supabase={from(name){assert.equal(name,'merchants');reads++;return {select(){return this},eq(_key,value){this.id=value;return this},async maybeSingle(){return {data:this.id===id?{id,name:'Demo Shop',merchant_code:'M001'}:null,error:null}}}}};
registerShopRequests({get(path,...handlers){routes.set(path,handlers)},post(){}},{database,supabase,auth,customerAuth:auth,merchantRole:role('merchant'),adminRole:role('admin')});
async function call(user,merchantId=id){const req={role:user,params:{id:merchantId}},res={code:200,headers:{},set(k,v){this.headers[k]=v;return this},status(n){this.code=n;return this},json(value){this.body=value;return this}};const handlers=routes.get('/api/admin/merchants/:id/qr-poster');let n=0;const next=()=>handlers[n++]?.(req,res,next);await next();return res;}
(async()=>{
 for(const user of [null,'customer','merchant','field_manager','staff','account_head'])assert.equal((await call(user)).code,user?403:401);
 assert.equal(reads,0,'Unauthorised users must not read merchants or QR tokens');
 assert.equal((await call('admin','invalid')).code,400);
 assert.equal((await call('admin','22222222-2222-4222-8222-222222222222')).code,404);
 const first=await call('admin');assert.equal(first.code,200);assert.equal(first.headers['Cache-Control'],'no-store');assert.equal(first.body.merchant.name,'Demo Shop');
 const payload=JSON.parse(first.body.payload);assert.equal(payload.kind,'ae_shop');assert.equal(payload.merchantId,id);assert.match(payload.token,/^[a-f0-9]{48}$/);
 assert.equal(await shopQrPayload(database,id),first.body.payload,'Admin and merchant must share one persistent QR');
 assert.equal((await call('admin')).body.payload,first.body.payload);assert.equal(writes,1,'Reopening poster must never rotate the printed QR');
 console.log('PASS: admin-only poster, invalid/unknown merchants, private response and persistent shared QR');
})().catch(error=>{console.error(error);process.exitCode=1});
