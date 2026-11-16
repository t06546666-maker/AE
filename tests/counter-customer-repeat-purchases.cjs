const assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../server.js'),'utf8');
const wiring=source.slice(source.indexOf("require('./backend/counter-customers.cjs')"),source.indexOf("require('./backend/counter-history.cjs')"));
assert(!wiring.includes('newCustomerOnly:true'));
const start=source.indexOf('async function onboardShopCustomer('),end=source.indexOf("app.post('/api/customers', requireAuth, onboardShopCustomer);",start);
let inserts=0,purchaseCalls=0;const notificationKinds=[];
const lookup={select(){return this},eq(){return this},maybeSingle:async()=>({data:{id:'existing',name:'Existing Customer',phone:'919876543210',customer_code:'C001'},error:null}),update(){return this},insert(){inserts++;throw Error('Duplicate customer account');}};
const handler=new Function('cleanText','normalizePhone','getAdminRewardConfig','supabaseAdmin','isEmail','processPurchase','getMerchantEarnRateWithCap','queueWhatsApp','resend','scheduleBackground',source.slice(start,end)+';return onboardShopCustomer;')((v)=>String(v||''),v=>'91'+String(v).replace(/^\+?91/,''),async()=>({}),{from:()=>lookup},()=>true,async(value,key)=>{purchaseCalls++;assert.equal(value.p_customer_code,'C001');assert.equal(value.p_merchant_id,'own-shop');assert.equal(value.p_amount,100);assert.equal(value.p_points_per_100,10);assert.equal(key,'purchase-'+purchaseCalls);return {data:[{total_points:purchaseCalls*10}]};},async()=>10,async(purchase,kind)=>{notificationKinds.push(kind);return {};},null,()=>{});
(async()=>{
 for(let i=1;i<=3;i++){let status,body;await handler({body:{name:'Typed name',phone:'9876543210',amount:100,rewardPercentage:10},auth:{profile:{role:'merchant',merchant_id:'own-shop'}},get:()=> 'purchase-'+i},{status(value){status=value;return this},json(value){body=value;return this}});assert.equal(status,201);assert.equal(body.customer.databaseId,'existing');assert.equal(body.customer.rewardPoints,i*10);assert.equal(body.customer.welcomeBonusPendingAppLogin,false);assert.equal(body.customer.temporaryPassword,undefined);}
 assert.equal(inserts,0);assert.equal(purchaseCalls,3);assert.deepEqual(notificationKinds,['reward','reward','reward']);
 console.log('PASS: Counter Staff uses merchant onboarding; three repeat purchases reuse one account, issue purchase points, and do not send registration/password messages.');
})().catch(error=>{console.error(error);process.exitCode=1});
