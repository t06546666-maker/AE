const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createProfilePushRegistry}=require('../backend/profile-push-registry.cjs');
const rows=new Map();const registry=createProfilePushRegistry(async()=>({collection(name){assert.equal(name,'ae_profile_push_registrations');return {doc(id){return {async get(){return {exists:rows.has(id),data:()=>rows.get(id)}},async set(value,options){assert.equal(options.merge,true);rows.set(id,{...rows.get(id),...value})}}}}}}));
(async()=>{
 const legacy={push_token:'old',push_enabled:true};assert.equal(await registry.get('merchant-a',legacy),legacy);
 await registry.save({id:'merchant-a',role:'merchant',merchant_id:'shop-a'},'member@example.com',{push_token:' fresh-token ',push_enabled:true,profile_id:'spoof'});
 let value=await registry.get('merchant-a',legacy);assert.equal(value.profile_id,'merchant-a');assert.equal(value.email,'member@example.com');assert.equal(value.push_token,'fresh-token');assert.equal(value.merchant_id,'shop-a');
 await registry.save({id:'merchant-a',role:'merchant',merchant_id:'shop-a'},'member@example.com',{push_enabled:false});value=await registry.get('merchant-a',legacy);assert.equal(value.push_enabled,false);assert.equal(value.push_token,'fresh-token');
 assert.equal((await registry.get('merchant-b',{})).push_token,undefined);
 await assert.rejects(registry.get('../bad'),/Invalid profile/);await assert.rejects(registry.save({id:'a'},null,{push_token:''}),/Invalid phone/);
 const server=fs.readFileSync('server.js','utf8');const start=server.indexOf("app.put('/api/profile/preferences'");const route=server.slice(start,server.indexOf("app.post('/api/auth/login'",start));
 let handler,saved,mirror=0,fail=false;
 vm.runInNewContext(route,{app:{put(path,...handlers){handler=handlers.at(-1)}},requireAuth(){},profilePushRegistry:{async save(...args){if(fail)throw Error('Firebase unavailable');saved=args}},supabaseAdmin:{from(){return {select(){return {eq(){return {async single(){return {data:{}}}}}}},update(){mirror++;return {async eq(){return {error:null}}}}}}},sendPushNotification:async()=>true,console});
 const req=body=>({body,auth:{profile:{id:'trusted',role:'merchant',merchant_id:'shop-a'},user:{id:'trusted',email:'trusted@example.com'}}});const res=()=>({code:200,status(n){this.code=n;return this},json(body){this.body=body;return this}});
 let r=res();await handler(req({push_token:'phone-token',push_enabled:true,email:'spoof@example.com',profile_id:'spoof'}),r);assert.equal(r.code,200);assert.equal(saved[0].id,'trusted');assert.equal(saved[1],'trusted@example.com');assert.equal(mirror,1);
 fail=true;r=res();await handler(req({push_token:'token'}),r);assert.equal(r.code,503);assert.equal(mirror,1);
 fail=false;r=res();await handler(req({push_enabled:'false'}),r);assert.equal(r.code,400);
 console.log('PASS: Firestore registration save/read/update, legacy fallback, profile isolation, strict token/preferences, trusted email/owner, Firebase outage retry response; no real registration sent.');
})().catch(e=>{console.error(e);process.exitCode=1});
