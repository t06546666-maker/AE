const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const scope={exports:{},setTimeout};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/pushRegistration.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,scope);
(async()=>{
 let calls=0;assert.equal(await scope.exports.savePushRegistration(async()=>{if(++calls<3)throw Error('network')},()=>true,async()=>{}),true);assert.equal(calls,3);
 calls=0;await assert.rejects(scope.exports.savePushRegistration(async()=>{calls++;throw {status:403}},()=>true,async()=>{}));assert.equal(calls,1);
 calls=0;assert.equal(await scope.exports.savePushRegistration(async()=>{calls++},()=>false),false);assert.equal(calls,0);
 const server=fs.readFileSync('server.js','utf8');let profiles=[{id:'a',push_token:'good'},{id:'b',push_enabled:false,push_token:'off'},{id:'c'},{id:'d',push_token:'bad'}],error=null,sent=[],inbox=[];
 const context={profilePushRegistry:{get:async(id,legacy)=>legacy},supabaseAdmin:{from(){return {select(){return {eq(){return {async eq(){return {data:profiles,error}}}}}}}}},saveAppNotification:async id=>inbox.push(id),sendPushNotification:async token=>{sent.push(token);return token==='good'}};
 vm.createContext(context);vm.runInContext(server.slice(server.indexOf('async function pushToMerchant('),server.indexOf('async function pushToCustomer(')),context);
 const result=await context.pushToMerchant('shop','title','body',{});
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{recipients:4,accepted:1,disabled:1,missingToken:1,failed:1});assert.deepEqual(sent,['good','bad']);assert.equal(inbox.length,4);
 sent=[];context.profilePushRegistry.get=async(id,legacy)=>id==='a'?{...legacy,push_token:'firebase-token'}:legacy;
 await context.pushToMerchant('shop','title','body',{});assert.ok(sent.includes('firebase-token'));assert.ok(!sent.includes('good'));
 sent=[];context.profilePushRegistry.get=async()=>{throw Error('Firebase unavailable')};
 const unavailable=await context.pushToMerchant('shop','title','body',{});assert.equal(unavailable.failed,4);assert.equal(sent.length,0);
 error={code:'unavailable'};await assert.rejects(context.pushToMerchant('shop','t','b'),/recipients unavailable/);
 console.log('PASS: token persistence retries, permission errors stop, disposed sessions stop; merchant token/opt-out handling, inbox independent of push, accurate FCM acceptance counts. Mocked only; phone delivery unverified.');
})().catch(e=>{console.error(e);process.exitCode=1});
