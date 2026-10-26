const assert=require('node:assert/strict'),fs=require('node:fs');
const {createProfilePushRegistry}=require('../backend/profile-push-registry.cjs');
const {registerMerchantPushSync}=require('../backend/merchant-push-sync.cjs');
const rows=new Map();let writes=0;
const database={collection(name){assert.equal(name,'ae_profile_push_registrations');return {doc(id){return {id}}}},async runTransaction(fn){return fn({async get(ref){return {exists:rows.has(ref.id),data:()=>rows.get(ref.id)}},set(ref,data){writes++;rows.set(ref.id,{...rows.get(ref.id),...data})}})}};
(async()=>{
 const registry=createProfilePushRegistry(async()=>database);
 let state=await registry.syncLegacy({id:'a',push_token:'legacy',push_enabled:true,email:'excluded',subscription:'excluded'});assert.equal(state.registered,true);assert.deepEqual(rows.get('a'),{push_token:'legacy',push_enabled:true});
 rows.set('a',{push_token:'newer',push_enabled:false});const before=writes;state=await registry.syncLegacy({id:'a',push_token:'older',push_enabled:true});assert.equal(state.enabled,false);assert.equal(writes,before);assert.equal(rows.get('a').push_token,'newer');
 state=await registry.syncLegacy({id:'empty'});assert.equal(state.registered,false);assert.equal(rows.has('empty'),false);
 let handler,selected,roleFilter,processed=0;const auth=()=>{},admin=()=>{};
 registerMerchantPushSync({post(path,...handlers){assert.equal(handlers[0],auth);assert.equal(handlers[1],admin);handler=handlers.at(-1)}},{auth,adminRole:admin,supabase:{from(table){assert.equal(table,'profiles');const q={select(value){selected=value;return q},eq(key,value){assert.equal(key,'role');roleFilter=value;return q},order(){return q},limit(){return q},gt(){return q},then(resolve,reject){return Promise.resolve({data:[{id:'a',push_token:'token'}]}).then(resolve,reject)}};return q}},registry:{async syncLegacy(){processed++;return {registered:true,enabled:true}}}});
 const res=()=>({code:200,status(n){this.code=n;return this},json(body){this.body=body;return this}});
 let r=res();await handler({body:{token:'ignored'}},r);assert.equal(r.code,200);assert.equal(r.body.registered,1);assert.equal(processed,1);assert.equal(roleFilter,'merchant');assert.equal(selected,'id,push_token,push_enabled');assert.ok(!JSON.stringify(r.body).includes('token'));
 r=res();await handler({body:{after:'bad'}},r);assert.equal(r.code,400);assert.equal(processed,1);
 assert.doesNotMatch(fs.readFileSync('backend/merchant-push-sync.cjs','utf8'),/\.send\(|sendPush|\.update\(|\.delete\(/);
 console.log('PASS: token/preference-only sync, preserve newer registrations and opt-outs, no invented tokens, admin-only batch endpoint, cursor validation and no notifications or subscription changes.');
})().catch(e=>{console.error(e);process.exitCode=1});
