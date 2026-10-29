const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('server.js','utf8');
const start=source.indexOf('async function pushToMerchant('),end=source.indexOf('async function pushToCustomer(',start);
async function main(){
 let release,sent=0,saved=0;
 const inbox=new Promise(resolve=>release=resolve);
 const query={select(){return this},eq(){return this},then(resolve){resolve({data:[{id:'p'}]})}};
 const context={supabaseAdmin:{from:()=>query},saveAppNotification:()=>{saved++;return inbox},profilePushRegistry:{get:async()=>({push_token:'test',push_enabled:true})},sendPushNotification:async()=>{sent++;return true},console};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+';this.send=pushToMerchant;',context);
 const pending=context.send('shop','title','body');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(saved,1);assert.equal(sent,1,'Phone push must start before inbox storage completes');
 release();assert.equal((await pending).accepted,1);
 context.profilePushRegistry.get=async()=>({push_token:'test',push_enabled:false});
 assert.equal((await context.send('shop','title','body')).disabled,1);assert.equal(sent,1);
 console.log('PASS: push dispatch does not wait for inbox storage; opt-out preserved.');
}main().catch(e=>{console.error(e);process.exitCode=1});
