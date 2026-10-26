const assert=require('node:assert/strict');const {registerMerchantPushDiagnostics}=require('../backend/merchant-push-diagnostics.cjs');
let get,post,profile={push_token:null},ready=true,sends=0,lookupId;const auth=()=>{},role=()=>{};
registerMerchantPushDiagnostics({get(path,...handlers){assert.equal(handlers[0],auth);assert.equal(handlers[1],role);get=handlers.at(-1)},post(path,...handlers){assert.equal(handlers[0],auth);assert.equal(handlers[1],role);post=handlers.at(-1)}},{auth,merchantRole:role,supabase:{from(){return {select(fields){assert.equal(fields,'push_token,push_enabled');return {eq(key,value){lookupId=value;return {async single(){return {data:profile}}}}}}}}},ready:async()=>ready,send:async(token,title,body,data)=>{assert.equal(token,'private-token');assert.equal(data.url,'/shop-checkout');sends++;return true}});
const req={auth:{profile:{id:'logged-in-merchant'}},body:{profileId:'attacker',token:'attacker'}};const res=()=>({code:200,set(){},status(n){this.code=n;return this},json(body){this.body=body;return this}});
(async()=>{
 let r=res();await get(req,r);assert.equal(r.body.registered,false);assert.equal(lookupId,'logged-in-merchant');assert.ok(!JSON.stringify(r.body).includes('push_token'));
 r=res();await post(req,r);assert.equal(r.code,409);assert.equal(sends,0);
 profile={push_token:'private-token',push_enabled:false};r=res();await post(req,r);assert.equal(r.code,409);assert.equal(sends,0);
 profile.push_enabled=true;ready=false;r=res();await post(req,r);assert.equal(r.code,503);assert.equal(sends,0);
 ready=true;r=res();await post(req,r);assert.equal(r.code,200);assert.equal(r.body.accepted,true);assert.equal(sends,1);assert.ok(!JSON.stringify(r.body).includes('private-token'));
 r=res();await post(req,r);assert.equal(r.code,429);assert.equal(sends,1);
 console.log('PASS: own-account status/test, no token exposure or arbitrary recipient, missing/disabled/unavailable handling, FCM acceptance and repeat-test cooldown. Mocked only.');
})().catch(e=>{console.error(e);process.exitCode=1});
