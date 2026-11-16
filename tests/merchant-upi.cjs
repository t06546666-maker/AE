const assert=require('node:assert/strict');
const {validUpi,paymentDetails,registerMerchantUpi}=require('../backend/merchant-upi.cjs');
(async()=>{
 assert(validUpi('test.shop@bank'));for(const id of ['', 'javascript:alert(1)','a@b','shop@bank&am=100'])assert(!validUpi(id));
 assert.equal(paymentDetails({upiId:'shop@bank'},'Shop',20),null);
 assert.equal(paymentDetails({enabled:true,upiId:'shop@bank'},'Shop',-1),null);
 const payment=paymentDetails({enabled:true,upiId:'shop@bank'},'Shop & Sons',98.5),url=new URL(payment.upiUrl);
 assert.equal(url.searchParams.get('pa'),'shop@bank');assert.equal(url.searchParams.get('am'),'98.50');assert.equal(url.searchParams.get('pn'),'Shop & Sons');assert.equal(url.searchParams.get('cu'),'INR');
 const records=new Map(),routes=new Map();
 const app={get:(path,...handlers)=>routes.set('GET '+path,handlers),put:(path,...handlers)=>routes.set('PUT '+path,handlers),post:(path,...handlers)=>routes.set('POST '+path,handlers)};
 const auth=(req,res,next)=>req.auth?next():res.status(401).json({}),role=(req,res,next)=>req.auth.profile.role==='merchant'?next():res.status(403).json({});
 registerMerchantUpi(app,{auth,merchantRole:role,database:async()=>({collection:()=>({doc:id=>({get:async()=>({data:()=>records.get(id)}),set:async(value)=>records.set(id,{...records.get(id),...value})})})}),upload:{single:()=>((q,r,next)=>next())},uploadImage:async()=>{throw Error('disabled')}});
 async function request(method,body,profile){const req={body,auth:profile?{profile}:null},res={code:200,status(code){this.code=code;return this},setHeader(){},json(data){this.data=data;return this}};const handlers=routes.get(method+' /api/merchant-profile/upi');let i=0;const next=()=>handlers[i++]?.(req,res,next);await next();return res;}
 assert.equal((await request('PUT',{enabled:true,upiId:'bad'},{role:'merchant',merchant_id:'A',id:'user'})).code,400);
 assert.equal((await request('PUT',{enabled:true,upiId:'a-shop@bank'},null)).code,401);
 assert.equal((await request('PUT',{enabled:true,upiId:'a-shop@bank'},{role:'customer'})).code,403);
 assert.equal((await request('PUT',{enabled:true,upiId:'a-shop@bank',merchant_id:'B',qrUrl:'javascript:bad'},{role:'merchant',merchant_id:'A',id:'user'})).code,200);
 assert.equal(records.has('B'),false);assert.equal(records.get('A').qrUrl,undefined);
 assert.equal((await request('GET',{}, {role:'merchant',merchant_id:'B',id:'user2'})).data.enabled,false);
 console.log('PASS: UPI amount/recipient encoding, disabled fallback, input validation, authorization, shop isolation and ignored QR injection.');
})().catch(e=>{console.error(e);process.exitCode=1});
