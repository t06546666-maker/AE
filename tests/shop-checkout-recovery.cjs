const assert=require('node:assert/strict');
const {registerShopRequests}=require('../backend/shop-checkout-requests.cjs');
(async()=>{
const routes=new Map(),app={get(){},post(path,...handlers){routes.set(path,handlers.at(-1));}};let row,finish;
const ref={get:async()=>({exists:true,data:()=>row}),update:async value=>Object.assign(row,value)};
registerShopRequests(app,{database:async()=>({collection:()=>({doc:()=>ref}),runTransaction:async fn=>fn({get:ref.get,update:(r,value)=>Object.assign(row,value)})}),auth(){},merchantRole(){},customerAuth(){},background:fn=>fn()});
async function attempt(code,started){row={merchantId:'shop',customerCode:'C001',action:'combined',status:'pending',expiresAt:Date.now()+60000};finish=null;const req={body:{shopRequestId:'abcdefghijklmnopqrst',customerCode:'C001',pointsToRedeem:100,amount:10,rewardPercentage:10},auth:{profile:{merchant_id:'shop'}},headers:{}};const res={statusCode:200,once:(event,fn)=>finish=fn,status(value){this.statusCode=value;return this},json(){}};let nextCalled=false;await routes.get('/api/checkouts')(req,res,()=>nextCalled=true);assert(nextCalled);assert.equal(row.status,'processing');req.checkoutPurchaseStarted=started;res.statusCode=code;await finish();return row;}
assert.equal((await attempt(400,false)).status,'pending');assert.equal((await attempt(503,false)).status,'pending');assert.equal((await attempt(400,true)).status,'needs_review');assert.equal((await attempt(503,true)).status,'needs_review');assert.equal((await attempt(201,true)).status,'completed');console.log('PASS: pre-purchase validation failures remain retryable; uncertain purchase attempts stay locked; success completes.');
})().catch(e=>{console.error(e);process.exitCode=1});
